import type {
  RelayClientConfig,
  PublishEventInput,
  PublishEventResult,
  BatchEventInput,
  PublishBatchResult,
} from './types';

const DEFAULT_BASE_URL = 'https://eba0ihdlc2.execute-api.us-east-1.amazonaws.com/prod';
const MAX_BATCH_SIZE = 25;
const MAX_RETRY_ATTEMPTS = 3;

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RelayClient {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly baseUrl: string;

  constructor(config: RelayClientConfig) {
    if (!config.apiKey) throw new Error('apiKey is required');
    if (!config.projectId) throw new Error('projectId is required');
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async publish(input: PublishEventInput): Promise<PublishEventResult> {
    return this.request<PublishEventResult>('POST', '/events', {
      event_type: input.eventType,
      payload: input.payload,
      idempotency_key: input.idempotencyKey,
      metadata: input.metadata,
    });
  }

  async publishBatch(input: BatchEventInput): Promise<PublishBatchResult> {
    if (input.events.length > MAX_BATCH_SIZE) {
      throw new Error(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
    }
    return this.request<PublishBatchResult>('POST', '/events/batch', {
      events: input.events.map((e) => ({
        event_type: e.eventType,
        payload: e.payload,
        idempotency_key: e.idempotencyKey,
        metadata: e.metadata,
      })),
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    attempt = 1,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-relay-api-key': this.apiKey,
        'x-relay-project-id': this.projectId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Retry on 429 with backoff respecting Retry-After header
    if (response.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
      const backoffMs = Math.max(retryAfterSeconds * 1000, Math.pow(2, attempt) * 250);
      await sleep(backoffMs);
      return this.request<T>(method, path, body, attempt + 1);
    }

    const envelope = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || !envelope.success) {
      const err = new Error(envelope.error?.message ?? 'Relay API error') as Error & {
        code: string;
        statusCode: number;
        attempt: number;
      };
      err.code = envelope.error?.code ?? 'UNKNOWN_ERROR';
      err.statusCode = response.status;
      err.attempt = attempt;
      throw err;
    }

    return envelope.data as T;
  }
}
