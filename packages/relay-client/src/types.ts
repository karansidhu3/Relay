export interface RelayClientConfig {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
}

export interface PublishEventInput {
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface PublishEventResult {
  eventId: string;
  status: string;
  eventType: string;
  queuedAt: string;
}

export interface BatchEventInput {
  events: PublishEventInput[];
}

export interface BatchResultItem {
  index: number;
  success: boolean;
  eventId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PublishBatchResult {
  results: BatchResultItem[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
