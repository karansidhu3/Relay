import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../lib/logger';
import { errorResponse, successResponse } from '../lib/response';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  logger.info('Ingest handler invoked', { requestId, path: event.path });

  try {
    // Phase 3: validate API key, parse body, idempotency check, write to DynamoDB, publish to SQS
    return successResponse(202, { message: 'not implemented' }, requestId);
  } catch (error) {
    logger.error('Ingest handler failed', { requestId, error });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected error occurred', requestId);
  }
};
