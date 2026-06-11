import type { WorkflowContext } from '../types/relay';
import { logger } from '../lib/logger';

export async function handleMarketmindCorpusIngestionStarted(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('MarketMind corpus ingestion workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: process corpus ingestion job
  return { status: 'stub_response' };
}

export async function handleMarketmindAnalysisRequested(
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  logger.info('MarketMind analysis workflow started', {
    event_id: context.eventId,
    attempt: context.attempt,
  });
  // Phase 6: run market analysis
  return { status: 'stub_response' };
}
