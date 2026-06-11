import type { APIGatewayProxyResult } from 'aws-lambda';
import type { ApiSuccessResponse, ApiErrorResponse } from '../types/relay';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-relay-api-key,x-relay-project-id',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function buildMeta(requestId: string): { request_id: string; timestamp: string } {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

export function successResponse<T>(
  statusCode: number,
  data: T,
  requestId = 'unknown',
): APIGatewayProxyResult {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: buildMeta(requestId),
  };
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId = 'unknown',
  field?: string,
): APIGatewayProxyResult {
  const body: ApiErrorResponse = {
    success: false,
    error: { code, message, ...(field !== undefined ? { field } : {}) },
    meta: buildMeta(requestId),
  };
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}
