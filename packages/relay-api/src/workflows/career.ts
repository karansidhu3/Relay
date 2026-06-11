import type { WorkflowContext } from '../types/relay';
import { logger } from '../lib/logger';

export async function handleCareerJobScoringRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('Career job scoring workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: call Claude API to score job posting against candidate resume
  return { status: 'stub_response' };
}

export async function handleCareerDocumentGenerationRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('Career document generation workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: generate resume/cover letter document
  return { status: 'stub_response' };
}

export async function handleCareerDigestDispatchScheduled(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('Career digest dispatch workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: compile and send digest via Resend
  return { status: 'stub_response' };
}
