// ── Status Constants ─────────────────────────────────────────────────────────

export const EVENT_STATUS = {
  RECEIVED: 'RECEIVED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  DEAD_LETTERED: 'DEAD_LETTERED',
} as const;

export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

export const EXECUTION_STATUS = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  TIMED_OUT: 'TIMED_OUT',
  SKIPPED: 'SKIPPED',
} as const;

export type ExecutionStatus = (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];

export const ERROR_TYPE = {
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  TRANSIENT_ERROR: 'TRANSIENT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorType = (typeof ERROR_TYPE)[keyof typeof ERROR_TYPE];

export const AUDIT_ACTION = {
  EVENT_RECEIVED: 'EVENT_RECEIVED',
  EXECUTION_STARTED: 'EXECUTION_STARTED',
  EXECUTION_COMPLETED: 'EXECUTION_COMPLETED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  DEAD_LETTERED: 'DEAD_LETTERED',
  CONFIG_CHANGED: 'CONFIG_CHANGED',
  PROJECT_CREATED: 'PROJECT_CREATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

// ── DynamoDB Item Interfaces ──────────────────────────────────────────────────

export interface RelayEvent {
  event_id: string;
  project_id: string;
  event_type: string;
  status: EventStatus;
  payload_ref: string;
  payload_size_bytes: number;
  source_ip: string;
  api_key_id: string;
  idempotency_key?: string;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: Record<string, string>;
  ttl?: number;
}

export interface RelayExecution {
  event_id: string;
  attempt: number;
  execution_id: string;
  project_id: string;
  event_type: string;
  status: ExecutionStatus;
  worker_function: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  error_type?: ErrorType;
  error_message?: string;
  error_stack?: string;
  output_ref?: string;
  log_stream?: string;
  retry_delay_ms: number;
  ttl?: number;
}

export interface RelayWorkflow {
  project_id: string;
  event_type: string;
  workflow_id: string;
  handler_function: string;
  description: string;
  is_active: boolean;
  timeout_seconds: number;
  max_attempts: number;
  base_delay_ms: number;
  backoff_multiplier: number;
  max_delay_ms: number;
  retry_on: ErrorType[];
  no_retry_on: ErrorType[];
  tags?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface RelayProject {
  project_id: string;
  name: string;
  description: string;
  api_key_hash: string;
  api_key_prefix: string;
  is_active: boolean;
  webhook_secret_arn?: string;
  contact_email: string;
  event_types_allowed: string[];
  rate_limit_per_minute: number;
  created_at: string;
  updated_at: string;
}

export interface RelayAuditRecord {
  project_id: string;
  sort_key: string;
  audit_id: string;
  action: AuditAction;
  actor: string;
  resource_type: 'event' | 'execution' | 'workflow' | 'project';
  resource_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  timestamp: string;
  ttl?: number;
}

// ── SQS Message Structure ────────────────────────────────────────────────────

export interface RelaySQSMessage {
  event_id: string;
  event_type: string;
  project_id: string;
  attempt: number;
  enqueued_at: string;
}

// ── API Request / Response Types ─────────────────────────────────────────────

export interface PublishEventRequest {
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key?: string;
  metadata?: Record<string, string>;
}

export interface PublishEventResponse {
  event_id: string;
  status: EventStatus;
  event_type: string;
  queued_at: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Workflow Execution Context ────────────────────────────────────────────────

export interface WorkflowContext {
  eventId: string;
  projectId: string;
  eventType: string;
  payload: Record<string, unknown>;
  workflow: RelayWorkflow;
  attempt: number;
}
