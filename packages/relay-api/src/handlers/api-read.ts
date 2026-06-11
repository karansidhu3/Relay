import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../lib/logger';
import { errorResponse, successResponse } from '../lib/response';
import {
  queryEventsByProject,
  getEventWithExecutions,
  getDashboardOverview,
} from '../services/dynamo';
import type { QueryEventsOptions } from '../services/dynamo';
import type { EventStatus } from '../types/relay';

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
    if (httpMethod === 'GET' && pathParameters?.event_id) {
      return handleGetEvent(pathParameters.event_id, requestId);
    }

    // GET /dashboard/overview
    if (httpMethod === 'GET' && (path === '/dashboard/overview' || path === '/prod/dashboard/overview')) {
      return handleGetDashboardOverview(requestId);
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
