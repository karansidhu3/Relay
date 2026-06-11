import type { EventBridgeEvent } from 'aws-lambda';
import { logger } from '../lib/logger';

export const handler = async (
  event: EventBridgeEvent<'Scheduled Event', Record<string, never>>,
): Promise<void> => {
  logger.info('Scheduler invoked', { source: event.source, time: event.time });
  // Phase 3: query relay-workflows for scheduled event types, publish to SQS
};
