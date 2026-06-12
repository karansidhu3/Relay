// ── CareerOS event payloads ───────────────────────────────────────────────────

export interface CareerJobIngestedPayload {
  job_id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  ingested_at: string;
}

export interface CareerJobScoringRequestedPayload {
  job_id: string;
  resume_id: string;
  candidate_id: string;
  scoring_model?: string;
  context?: {
    target_roles?: string[];
    preferred_stack?: string[];
  };
}

export interface CareerDocumentGenerationRequestedPayload {
  job_id: string;
  candidate_id: string;
  document_type: 'resume' | 'cover_letter';
  template_id?: string;
  customization_notes?: string;
}

export interface CareerDigestDispatchScheduledPayload {
  candidate_id: string;
  period: string;
  new_jobs_count: number;
  digest_type: 'daily' | 'weekly';
}

// ── MarketMind event payloads ─────────────────────────────────────────────────

export interface MarketmindCorpusIngestionStartedPayload {
  corpus_id: string;
  document_count: number;
  source: string;
  s3_manifest: string;
  ticker_symbols?: string[];
}

export interface MarketmindEmbeddingPipelineRequestedPayload {
  corpus_id: string;
  document_ids: string[];
  embedding_model: string;
  chunk_size?: number;
  chunk_overlap?: number;
}

export interface MarketmindSignalGenerationRequestedPayload {
  ticker: string;
  signal_type: string;
  corpus_ids: string[];
  window_days?: number;
}

// ── TimeKeep event payloads ───────────────────────────────────────────────────

export interface TimekeepClockeventRecordedPayload {
  employee_id: string;
  business_id: string;
  event_type: 'clock_in' | 'clock_out';
  timestamp: string;
  location?: string;
  shift_id?: string;
}

export interface TimekeepPayrollExportRequestedPayload {
  business_id: string;
  period_start: string;
  period_end: string;
  format: 'csv' | 'json';
  employee_ids?: string[];
}

export interface TimekeepNotificationDispatchRequestedPayload {
  recipient_id: string;
  channel: 'sms' | 'email' | 'push';
  template: string;
  variables?: Record<string, string>;
}

// ── Client config and generic types ──────────────────────────────────────────

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
