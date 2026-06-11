import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';
import { classifyError, truncateStack, WorkflowNotFoundError } from '../lib/errors';
import { calculateBackoffDelay, shouldRetry, DEFAULT_RETRY_CONFIG } from '../lib/retry';
import { getRequiredEnv } from '../lib/validate';
import {
  getEvent,
  getWorkflow,
  getExecution,
  putExecution,
  updateExecution,
  updateEventStatus,
} from '../services/dynamo';
import { changeMessageVisibility } from '../services/sqs';
import { getPayload } from '../services/s3';
import { EVENT_STATUS, EXECUTION_STATUS, ERROR_TYPE } from '../types/relay';
import type { RelaySQSMessage, RelayExecution, WorkflowContext } from '../types/relay';
import { handleCareerJobScoringRequested, handleCareerDocumentGenerationRequested, handleCareerDigestDispatchScheduled } from '../workflows/career';
import { handleMarketmindCorpusIngestionStarted, handleMarketmindAnalysisRequested } from '../workflows/marketmind';
import { handleTimekeepClockeventRecorded, handleTimekeepNotificationDispatchRequested } from '../workflows/timekeep';

const config = {
  mainQueueUrl: getRequiredEnv('MAIN_QUEUE_URL'),
};

type WorkflowHandler = (ctx: WorkflowContext) => Promise<Record<string, unknown>>;

const WORKFLOW_HANDLERS: Record<string, WorkflowHandler> = {
  'career.job.scoring.requested': handleCareerJobScoringRequested,
  'career.document.generation.requested': handleCareerDocumentGenerationRequested,
  'career.digest.dispatch.scheduled': handleCareerDigestDispatchScheduled,
  'marketmind.corpus.ingestion.started': handleMarketmindCorpusIngestionStarted,
  'marketmind.analysis.requested': handleMarketmindAnalysisRequested,
  'timekeep.clockevent.recorded': handleTimekeepClockeventRecorded,
  'timekeep.notification.dispatch.requested': handleTimekeepNotificationDispatchRequested,
};

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    const messageId = record.messageId;
    const receiptHandle = record.receiptHandle;
    const attempt = parseInt(record.attributes.ApproximateReceiveCount, 10);

    let eventId = 'unknown';

    try {
      // ── 1. Parse SQS message ────────────────────────────────────────────────
      const message = JSON.parse(record.body) as RelaySQSMessage;
      eventId = message.event_id;
      const { event_type: eventType, project_id: projectId } = message;

      logger.info('Execution started', { event_id: eventId, event_type: eventType, attempt });

      // ── 2. Fetch event — skip if not found or already terminal ──────────────
      const relayEvent = await getEvent(eventId);
      if (!relayEvent) {
        logger.warn('Event not found in DynamoDB, skipping', { event_id: eventId, messageId });
        continue;
      }

      if (
        relayEvent.status === EVENT_STATUS.COMPLETED ||
        relayEvent.status === EVENT_STATUS.DEAD_LETTERED
      ) {
        logger.info('Event already in terminal state, skipping', {
          event_id: eventId,
          status: relayEvent.status,
        });
        continue;
      }

      // ── 3. Fetch workflow config ────────────────────────────────────────────
      const workflow = await getWorkflow(projectId, eventType);
      if (!workflow || !workflow.is_active) {
        throw new WorkflowNotFoundError(eventType, projectId);
      }

      // ── 4. Execution idempotency — skip if this attempt already completed ───
      const existingExecution = await getExecution(eventId, attempt);
      if (existingExecution?.status === EXECUTION_STATUS.COMPLETED) {
        logger.info('Execution already completed for this attempt, skipping', {
          event_id: eventId,
          attempt,
        });
        continue;
      }

      // ── 5. Fetch payload ────────────────────────────────────────────────────
      let payload: Record<string, unknown>;
      if (relayEvent.payload_ref.startsWith('inline:')) {
        payload = JSON.parse(relayEvent.payload_ref.slice(7)) as Record<string, unknown>;
      } else if (relayEvent.payload_ref.startsWith('s3:')) {
        const s3Path = relayEvent.payload_ref.slice(3);
        const slashIdx = s3Path.indexOf('/');
        const bucket = s3Path.slice(0, slashIdx);
        const key = s3Path.slice(slashIdx + 1);
        payload = await getPayload(bucket, key);
      } else {
        throw new Error(`Unknown payload_ref format: ${relayEvent.payload_ref}`);
      }

      // ── 6. Create execution record (RUNNING) ────────────────────────────────
      const executionId = `exec_${uuidv4().replace(/-/g, '')}`;
      const startedAt = new Date().toISOString();
      const retryDelayMs =
        attempt > 1
          ? calculateBackoffDelay(attempt - 1, {
              baseDelayMs: workflow.base_delay_ms,
              backoffMultiplier: workflow.backoff_multiplier,
              maxDelayMs: workflow.max_delay_ms,
            })
          : 0;

      const execution: RelayExecution = {
        event_id: eventId,
        attempt,
        execution_id: executionId,
        project_id: projectId,
        event_type: eventType,
        status: EXECUTION_STATUS.RUNNING,
        worker_function: 'relay-worker',
        started_at: startedAt,
        retry_delay_ms: retryDelayMs,
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
      };

      try {
        await putExecution(execution);
      } catch (condErr) {
        // ConditionalCheckFailedException means another invocation already wrote this execution.
        if (
          condErr instanceof Error &&
          condErr.name === 'ConditionalCheckFailedException'
        ) {
          logger.warn('Execution record already exists, skipping duplicate invocation', {
            event_id: eventId,
            attempt,
          });
          continue;
        }
        throw condErr;
      }

      await updateEventStatus(eventId, EVENT_STATUS.PROCESSING, { attempt_count: attempt });

      // ── 7. Dispatch to workflow handler ─────────────────────────────────────
      const workflowHandler = WORKFLOW_HANDLERS[eventType];
      if (!workflowHandler) {
        throw new WorkflowNotFoundError(eventType, projectId);
      }

      const ctx: WorkflowContext = {
        eventId,
        projectId,
        eventType,
        payload,
        workflow,
        attempt,
      };

      const output = await workflowHandler(ctx);

      // ── 8. Record success ───────────────────────────────────────────────────
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - new Date(startedAt).getTime();

      await updateExecution(eventId, attempt, {
        status: EXECUTION_STATUS.COMPLETED,
        completed_at: completedAt,
        duration_ms: durationMs,
        output_ref: `inline:${JSON.stringify(output)}`,
      });

      await updateEventStatus(eventId, EVENT_STATUS.COMPLETED, {
        completed_at: completedAt,
        attempt_count: attempt,
      });

      logger.info('Execution completed', {
        event_id: eventId,
        execution_id: executionId,
        duration_ms: durationMs,
        attempt,
      });
    } catch (error) {
      const errorType = classifyError(error);
      const isRetryable = shouldRetry(
        errorType,
        [ERROR_TYPE.TRANSIENT_ERROR, ERROR_TYPE.RATE_LIMIT, ERROR_TYPE.TIMEOUT, ERROR_TYPE.UNKNOWN],
        [ERROR_TYPE.VALIDATION_ERROR, ERROR_TYPE.SCHEMA_ERROR],
      );

      logger.error('Execution failed', {
        event_id: eventId,
        messageId,
        error_type: errorType,
        error: error instanceof Error ? error.message : String(error),
        will_retry: isRetryable,
        attempt,
      });

      // Update execution record to FAILED (best-effort — don't let update failures mask the original error).
      try {
        if (eventId !== 'unknown') {
          await updateExecution(eventId, attempt, {
            status: EXECUTION_STATUS.FAILED,
            completed_at: new Date().toISOString(),
            error_type: errorType,
            error_message: error instanceof Error ? error.message : String(error),
            error_stack: truncateStack(error instanceof Error ? error.stack : undefined),
          });

          if (!isRetryable) {
            await updateEventStatus(eventId, EVENT_STATUS.FAILED);
          }
        }
      } catch (updateErr) {
        logger.error('Failed to update execution/event record after failure', {
          event_id: eventId,
          update_error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }

      if (isRetryable) {
        // Change visibility timeout to implement exponential backoff between SQS retries.
        const delayMs = calculateBackoffDelay(attempt, DEFAULT_RETRY_CONFIG);
        try {
          await changeMessageVisibility(
            receiptHandle,
            config.mainQueueUrl,
            Math.ceil(delayMs / 1000),
          );
        } catch (visErr) {
          logger.warn('Failed to change message visibility timeout', {
            event_id: eventId,
            vis_error: visErr instanceof Error ? visErr.message : String(visErr),
          });
        }
        batchItemFailures.push({ itemIdentifier: messageId });
      }
      // Non-retryable: do not add to batchItemFailures; SQS will delete the message.
    }
  }

  return { batchItemFailures };
};
