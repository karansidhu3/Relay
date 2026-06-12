import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../lib/logger';
import { errorResponse, successResponse } from '../lib/response';
import {
  getEvent,
  queryEventsByProject,
  getEventWithExecutions,
  getDashboardOverview,
  getDlqEvents,
  updateEventStatus,
  listProjects,
} from '../services/dynamo';
import { getPayload } from '../services/s3';
import { getRequiredEnv } from '../lib/validate';
import { publishToMainQueue } from '../services/sqs';
import type { QueryEventsOptions } from '../services/dynamo';
import { EVENT_STATUS } from '../types/relay';
import type { EventStatus, RelaySQSMessage } from '../types/relay';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  const { path, httpMethod, pathParameters, queryStringParameters } = event;

  logger.info('API read handler invoked', { requestId, path, httpMethod });

  try {
    // GET /events
    if (httpMethod === 'GET' && (path === '/events' || path === '/prod/events')) {
      return handleGetEvents(queryStringParameters ?? {}, requestId);
    }

    // GET /events/{event_id}
    if (httpMethod === 'GET' && pathParameters?.event_id && path.includes('/events/')) {
      return handleGetEvent(pathParameters.event_id, requestId);
    }

    // GET /dashboard/overview
    if (httpMethod === 'GET' && path.endsWith('/dashboard/overview')) {
      return handleGetDashboardOverview(requestId);
    }

    // GET /dashboard/projects
    if (httpMethod === 'GET' && path.endsWith('/dashboard/projects')) {
      return handleGetProjects(requestId);
    }

    // GET /dashboard/dlq
    if (httpMethod === 'GET' && path.endsWith('/dashboard/dlq')) {
      return handleGetDlq(requestId);
    }

    // POST /dashboard/dlq/{event_id}/requeue
    if (httpMethod === 'POST' && path.endsWith('/requeue') && pathParameters?.event_id) {
      return handleRequeue(pathParameters.event_id, requestId);
    }

    // GET /events/{event_id}/payload
    if (httpMethod === 'GET' && path.endsWith('/payload') && pathParameters?.event_id) {
      return handleGetPayload(pathParameters.event_id, requestId);
    }

    return errorResponse(404, 'NOT_FOUND', `Route not found: ${httpMethod} ${path}`, requestId);
  } catch (error) {
    logger.error('API read handler failed', {
      requestId,
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected error occurred', requestId);
  }
};

async function handleGetEvents(
  qs: Record<string, string | null | undefined>,
  requestId: string,
): Promise<APIGatewayProxyResult> {
  const projectId = qs['project_id'];
  if (!projectId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'project_id query parameter is required', requestId, 'project_id');
  }

  const options: QueryEventsOptions = {};
  if (qs['status']) options.status = qs['status'] as EventStatus;
  if (qs['since']) options.since = qs['since'];
  if (qs['until']) options.until = qs['until'];
  if (qs['limit']) {
    const parsed = parseInt(qs['limit'], 10);
    if (!isNaN(parsed)) options.limit = parsed;
  }
  if (qs['cursor']) options.cursor = qs['cursor'];

  const { events, cursor } = await queryEventsByProject(projectId, options);

  logger.info('GET /events completed', { project_id: projectId, count: events.length, requestId });

  return successResponse(200, { events, cursor, count: events.length }, requestId);
}

async function handleGetEvent(eventId: string, requestId: string): Promise<APIGatewayProxyResult> {
  const result = await getEventWithExecutions(eventId);

  if (!result) {
    return errorResponse(404, 'NOT_FOUND', `Event '${eventId}' not found`, requestId);
  }

  logger.info('GET /events/:id completed', {
    event_id: eventId,
    execution_count: result.executions.length,
    requestId,
  });

  return successResponse(200, result, requestId);
}

async function handleGetDashboardOverview(requestId: string): Promise<APIGatewayProxyResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const overview = await getDashboardOverview(since);

  logger.info('GET /dashboard/overview completed', { total_events: overview.total_events, requestId });

  return successResponse(200, overview, requestId);
}

async function handleGetDlq(requestId: string): Promise<APIGatewayProxyResult> {
  const events = await getDlqEvents();

  logger.info('GET /dashboard/dlq completed', { count: events.length, requestId });

  return successResponse(200, { events, count: events.length }, requestId);
}

async function handleGetProjects(requestId: string): Promise<APIGatewayProxyResult> {
  const projects = await listProjects();
  const safeProjects = projects.map(({ api_key_hash: _hash, ...rest }) => rest);

  logger.info('GET /dashboard/projects completed', { count: projects.length, requestId });

  return successResponse(200, { projects: safeProjects, count: safeProjects.length }, requestId);
}

async function handleGetPayload(eventId: string, requestId: string): Promise<APIGatewayProxyResult> {
  const event = await getEvent(eventId);

  if (!event) {
    return errorResponse(404, 'NOT_FOUND', `Event '${eventId}' not found`, requestId);
  }

  const ref = event.payload_ref;

  if (ref.startsWith('inline:')) {
    const json = ref.slice('inline:'.length);
    return successResponse(200, {
      payload: JSON.parse(json) as Record<string, unknown>,
      source: 'inline',
      size_bytes: event.payload_size_bytes,
    }, requestId);
  }

  if (ref.startsWith('s3:')) {
    const withoutScheme = ref.slice('s3:'.length);
    const slashIndex = withoutScheme.indexOf('/');
    const bucket = withoutScheme.slice(0, slashIndex);
    const key = withoutScheme.slice(slashIndex + 1);
    const payload = await getPayload(bucket, key);
    return successResponse(200, { payload, source: 's3', size_bytes: event.payload_size_bytes }, requestId);
  }

  // Legacy fallback: try PAYLOAD_BUCKET env var
  const bucket = getRequiredEnv('PAYLOAD_BUCKET');
  const payload = await getPayload(bucket, ref);
  return successResponse(200, { payload, source: 's3', size_bytes: event.payload_size_bytes }, requestId);
}

async function handleRequeue(eventId: string, requestId: string): Promise<APIGatewayProxyResult> {
  const relayEvent = await getEvent(eventId);

  if (!relayEvent) {
    return errorResponse(404, 'NOT_FOUND', `Event '${eventId}' not found`, requestId);
  }

  if (relayEvent.status !== EVENT_STATUS.DEAD_LETTERED) {
    return errorResponse(
      409,
      'INVALID_STATE',
      `Event is not DEAD_LETTERED (current: ${relayEvent.status})`,
      requestId,
    );
  }

  const now = new Date().toISOString();
  const sqsMessage: RelaySQSMessage = {
    event_id: eventId,
    event_type: relayEvent.event_type,
    project_id: relayEvent.project_id,
    // Continue from where retries left off so execution records don't collide with previous attempts.
    attempt: relayEvent.attempt_count + 1,
    enqueued_at: now,
  };

  await publishToMainQueue(sqsMessage);
  await updateEventStatus(eventId, EVENT_STATUS.QUEUED);

  logger.info('Dead-lettered event requeued', { event_id: eventId, event_type: relayEvent.event_type, requestId });

  return successResponse(200, { event_id: eventId, status: EVENT_STATUS.QUEUED, requeued_at: now }, requestId);
}
