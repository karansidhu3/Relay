import type {
  RelayClientConfig,
  PublishEventInput,
  PublishEventResult,
  BatchEventInput,
  PublishBatchResult,
} from './types';

const DEFAULT_BASE_URL = 'https://api.relay.example.com/prod';
const MAX_BATCH_SIZE = 25;

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
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

    const envelope = (await response.json()) as ApiEnvelope<T>;

    if (!response.ok || !envelope.success) {
      const err = new Error(envelope.error?.message ?? 'Relay API error') as Error & {
        code: string;
        statusCode: number;
      };
      err.code = envelope.error?.code ?? 'UNKNOWN_ERROR';
      err.statusCode = response.status;
      throw err;
    }

    return envelope.data as T;
  }
}
