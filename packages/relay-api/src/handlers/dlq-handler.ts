import type { SQSEvent } from 'aws-lambda';
import { logger } from '../lib/logger';
import { emitMetric } from '../lib/metrics';
import { getRequiredEnv } from '../lib/validate';
import { getEventWithExecutions, updateEventStatus } from '../services/dynamo';
import { putPayload, getPayload } from '../services/s3';
import { EVENT_STATUS } from '../types/relay';
import type { RelaySQSMessage } from '../types/relay';

const config = {
  snapshotsBucket: getRequiredEnv('SNAPSHOTS_BUCKET'),
};

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const messageId = record.messageId;
    let eventId = 'unknown';

    try {
      const message = JSON.parse(record.body) as RelaySQSMessage;
      eventId = message.event_id;
      const { event_type: eventType, project_id: projectId } = message;

      logger.info('DLQ handler processing dead-lettered event', {
        event_id: eventId,
        event_type: eventType,
        messageId,
      });

      // ── 1. Fetch event + full execution history ─────────────────────────────
      const result = await getEventWithExecutions(eventId);
      if (!result) {
        logger.warn('Event not found in DynamoDB, skipping DLQ processing', {
          event_id: eventId,
          messageId,
        });
        continue;
      }

      const { event: relayEvent, executions } = result;

      // ── 2. Fetch payload (best-effort — snapshot is still written without it) ─
      let payload: unknown = {};
      try {
        if (relayEvent.payload_ref.startsWith('inline:')) {
          payload = JSON.parse(relayEvent.payload_ref.slice(7));
        } else if (relayEvent.payload_ref.startsWith('s3:')) {
          const s3Path = relayEvent.payload_ref.slice(3);
          const slashIdx = s3Path.indexOf('/');
          const bucket = s3Path.slice(0, slashIdx);
          const key = s3Path.slice(slashIdx + 1);
          payload = await getPayload(bucket, key);
        }
      } catch (payloadErr) {
        logger.warn('Failed to fetch payload for failure snapshot, continuing without it', {
          event_id: eventId,
          error: payloadErr instanceof Error ? payloadErr.message : String(payloadErr),
        });
      }

      // ── 3. Write failure snapshot to S3 ────────────────────────────────────
      const deadLetteredAt = new Date().toISOString();
      const snapshotKey = `${projectId}/${eventId}/failure-snapshot.json`;

      await putPayload(config.snapshotsBucket, snapshotKey, {
        event: relayEvent,
        executions,
        payload,
        dead_lettered_at: deadLetteredAt,
        original_sqs_message: message,
      });

      logger.info('Failure snapshot written', {
        event_id: eventId,
        snapshot_key: snapshotKey,
        attempt_count: executions.length,
      });

      // ── 4. Update event status to DEAD_LETTERED ─────────────────────────────
      await updateEventStatus(eventId, EVENT_STATUS.DEAD_LETTERED, {
        completed_at: deadLetteredAt,
      });

      // ── 5. Emit CloudWatch metric via EMF ───────────────────────────────────
      emitMetric('ExecutionDeadLettered', 1, 'Count', {
        EventType: eventType,
        ProjectId: projectId,
      });

      logger.info('Event marked DEAD_LETTERED', {
        event_id: eventId,
        event_type: eventType,
        project_id: projectId,
        attempt_count: executions.length,
        snapshot_key: snapshotKey,
      });
    } catch (error) {
      logger.error('DLQ handler failed for message', {
        event_id: eventId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Re-throw so Lambda marks the invocation failed.
      // The DLQ has no redrive, so this is safe — the message stays visible for inspection.
      throw error;
    }
  }
};
