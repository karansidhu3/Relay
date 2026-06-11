import type { ErrorType } from '../types/relay';
import { ERROR_TYPE } from '../types/relay';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class IdempotencyConflictError extends Error {
  constructor(public readonly existingEventId: string) {
    super(`Event with this idempotency key already exists: ${existingEventId}`);
    this.name = 'IdempotencyConflictError';
  }
}

export class EventTypeNotAllowedError extends Error {
  constructor(eventType: string) {
    super(`Event type not in project allowlist: ${eventType}`);
    this.name = 'EventTypeNotAllowedError';
  }
}

export class RateLimitExceededError extends Error {
  constructor() {
    super('Rate limit exceeded for this project');
    this.name = 'RateLimitExceededError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor(sizeBytes: number) {
    super(`Payload too large: ${sizeBytes} bytes exceeds 10MB limit`);
    this.name = 'PayloadTooLargeError';
  }
}

export class WorkflowExecutionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WorkflowExecutionError';
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(eventType: string, projectId: string) {
    super(`No active workflow found for event type '${eventType}' in project '${projectId}'`);
    this.name = 'WorkflowNotFoundError';
  }
}

export function classifyError(error: unknown): ErrorType {
  if (error instanceof ValidationError) return ERROR_TYPE.VALIDATION_ERROR;
  if (error instanceof EventTypeNotAllowedError) return ERROR_TYPE.VALIDATION_ERROR;
  if (error instanceof WorkflowNotFoundError) return ERROR_TYPE.SCHEMA_ERROR;
  if (error instanceof IdempotencyConflictError) return ERROR_TYPE.VALIDATION_ERROR;
  if (error instanceof RateLimitExceededError) return ERROR_TYPE.RATE_LIMIT;
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return ERROR_TYPE.TIMEOUT;
  }
  if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
    return ERROR_TYPE.RATE_LIMIT;
  }
  return ERROR_TYPE.UNKNOWN;
}

export function truncateStack(stack: string | undefined, maxBytes = 2048): string {
  if (!stack) return '';
  return stack.length > maxBytes ? stack.slice(0, maxBytes) + '...[truncated]' : stack;
}
