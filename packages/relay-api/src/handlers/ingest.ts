import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';
import { errorResponse, successResponse } from '../lib/response';
import { validateEventType, validatePayloadSize, requiresS3Offload, getRequiredEnv } from '../lib/validate';
import { ValidationError, PayloadTooLargeError } from '../lib/errors';
import { getProject, putEvent, updateEventStatus, getEventByIdempotencyKey } from '../services/dynamo';
import { publishToMainQueue } from '../services/sqs';
import { putPayload } from '../services/s3';
import { EVENT_STATUS } from '../types/relay';
import type { RelayEvent, PublishEventRequest, PublishEventResponse, RelaySQSMessage } from '../types/relay';

const config = {
  payloadBucket: getRequiredEnv('PAYLOAD_BUCKET'),
};

// In-memory project cache — valid for the lifetime of a warm Lambda instance.
// Avoids a DynamoDB read + bcrypt comparison on every request for the same project.
const projectCache = new Map<string, { project: Awaited<ReturnType<typeof getProject>>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  logger.info('Ingest handler invoked', { requestId, path: event.path });

  try {
    // ── 1. Extract and validate headers ────────────────────────────────────────
    const projectId =
      event.headers['x-relay-project-id'] ?? event.headers['X-Relay-Project-Id'];
    const apiKey =
      event.headers['x-relay-api-key'] ?? event.headers['X-Relay-Api-Key'];

    if (!projectId || !apiKey) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        'x-relay-api-key and x-relay-project-id headers are required',
        requestId,
      );
    }

    // ── 2. Validate API key against relay-projects ──────────────────────────────
    const cached = projectCache.get(projectId);
    let project = cached && cached.expiresAt > Date.now() ? cached.project : null;

    if (!project) {
      project = await getProject(projectId);
      if (project) {
        projectCache.set(projectId, { project, expiresAt: Date.now() + CACHE_TTL_MS });
      }
    }

    if (!project || !project.is_active) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid API key', requestId);
    }

    const isValidKey = await bcrypt.compare(apiKey, project.api_key_hash);
    if (!isValidKey) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid API key', requestId);
    }

    // ── 3. Parse request body ──────────────────────────────────────────────────
    if (!event.body) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Request body is required', requestId);
    }

    let body: PublishEventRequest;
    try {
      body = JSON.parse(event.body) as PublishEventRequest;
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON body', requestId);
    }

    if (!body.event_type) {
      return errorResponse(400, 'VALIDATION_ERROR', 'event_type is required', requestId, 'event_type');
    }
    if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'payload is required and must be an object', requestId, 'payload');
    }

    // ── 4. Validate event_type format and allowlist ────────────────────────────
    validateEventType(body.event_type);

    if (!project.event_types_allowed.includes(body.event_type)) {
      return errorResponse(
        403,
        'EVENT_TYPE_NOT_ALLOWED',
        `Event type '${body.event_type}' is not allowed for this project`,
        requestId,
      );
    }

    // ── 5. Validate payload size ───────────────────────────────────────────────
    const payloadJson = JSON.stringify(body.payload);
    const payloadBytes = Buffer.byteLength(payloadJson, 'utf8');
    validatePayloadSize(payloadBytes);

    // ── 6. Idempotency check ───────────────────────────────────────────────────
    if (body.idempotency_key) {
      const existing = await getEventByIdempotencyKey(projectId, body.idempotency_key);
      if (existing) {
        logger.info('Idempotency duplicate detected', {
          event_id: existing.event_id,
          idempotency_key: body.idempotency_key,
          requestId,
        });
        return errorResponse(
          409,
          'DUPLICATE_EVENT',
          `Event with idempotency key '${body.idempotency_key}' already exists`,
          requestId,
        );
      }
    }

    // ── 7. Generate event ID and route payload ─────────────────────────────────
    const eventId = `evt_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

    let payloadRef: string;
    if (requiresS3Offload(payloadBytes)) {
      const s3Key = `${projectId}/${eventId}/payload.json`;
      await putPayload(config.payloadBucket, s3Key, body.payload);
      payloadRef = `s3:${config.payloadBucket}/${s3Key}`;
      logger.info('Payload offloaded to S3', { event_id: eventId, s3_key: s3Key, payload_size_bytes: payloadBytes });
    } else {
      payloadRef = `inline:${payloadJson}`;
    }

    // ── 8. Write event record (RECEIVED) ───────────────────────────────────────
    const relayEvent: RelayEvent = {
      event_id: eventId,
      project_id: projectId,
      event_type: body.event_type,
      status: EVENT_STATUS.RECEIVED,
      payload_ref: payloadRef,
      payload_size_bytes: payloadBytes,
      source_ip: event.requestContext.identity?.sourceIp ?? 'unknown',
      api_key_id: project.api_key_prefix,
      idempotency_key: body.idempotency_key,
      attempt_count: 0,
      created_at: now,
      updated_at: now,
      metadata: body.metadata,
      ttl,
    };

    await putEvent(relayEvent);
    logger.info('Event record written', { event_id: eventId, event_type: body.event_type, status: 'RECEIVED' });

    // ── 9. Publish to SQS ──────────────────────────────────────────────────────
    const sqsMessage: RelaySQSMessage = {
      event_id: eventId,
      event_type: body.event_type,
      project_id: projectId,
      attempt: 1,
      enqueued_at: now,
    };

    await publishToMainQueue(sqsMessage);
    logger.info('Event published to SQS', { event_id: eventId });

    // ── 10. Update status to QUEUED ────────────────────────────────────────────
    await updateEventStatus(eventId, EVENT_STATUS.QUEUED);

    logger.info('Ingest completed', { event_id: eventId, event_type: body.event_type, requestId });

    return successResponse<PublishEventResponse>(
      202,
      {
        event_id: eventId,
        status: EVENT_STATUS.QUEUED,
        event_type: body.event_type,
        queued_at: now,
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message, requestId, error.field);
    }
    if (error instanceof PayloadTooLargeError) {
      return errorResponse(400, 'PAYLOAD_TOO_LARGE', error.message, requestId);
    }
    logger.error('Ingest handler failed', { requestId, error: error instanceof Error ? error.message : String(error) });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected error occurred', requestId);
  }
};
