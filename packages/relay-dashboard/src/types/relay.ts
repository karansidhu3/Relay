export type EventStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTERED';

export type ExecutionStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED';

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
  error_type?: string;
  error_message?: string;
  error_stack?: string;
  output_ref?: string;
  log_stream?: string;
  retry_delay_ms: number;
}

export interface ProjectEventCount {
  project_id: string;
  name: string;
  count: number;
}

export interface TypeEventCount {
  event_type: string;
  count: number;
}

export interface OverviewStats {
  period: string;
  total_events: number;
  completed: number;
  failed: number;
  dead_lettered: number;
  processing: number;
  success_rate: number;
  avg_execution_ms: number;
  events_by_project: ProjectEventCount[];
  events_by_type: TypeEventCount[];
}

export interface RelayProjectSafe {
  project_id: string;
  name: string;
  is_active: boolean;
  event_types_allowed: string[];
  created_at: string;
  rate_limit_per_minute: number;
}

export interface EventsPage {
  events: RelayEvent[];
  cursor?: string;
  count: number;
}

export interface EventDetail {
  event: RelayEvent;
  executions: RelayExecution[];
}

export interface DlqResponse {
  events: RelayEvent[];
  count: number;
}

export interface ApiSuccessResponse<T> {
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

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
