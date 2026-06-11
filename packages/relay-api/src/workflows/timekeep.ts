import type { WorkflowContext } from '../types/relay';
import { logger } from '../lib/logger';

export async function handleTimekeepClockeventRecorded(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('TimeKeep clock event workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: process clock-in/clock-out event
  return { status: 'stub_response' };
}

export async function handleTimekeepNotificationDispatchRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('TimeKeep notification dispatch workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: send notification via Twilio or Resend
  return { status: 'stub_response' };
}
