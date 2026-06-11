import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../lib/logger';
import { errorResponse, successResponse } from '../lib/response';

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  logger.info('API read handler invoked', { requestId, path: event.path });

  try {
    // Phase 3: route to GET /events, GET /events/:id, GET /dashboard/overview, etc.
    return successResponse(200, { message: 'not implemented' }, requestId);
  } catch (error) {
    logger.error('API read handler failed', { requestId, error });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected error occurred', requestId);
  }
};
