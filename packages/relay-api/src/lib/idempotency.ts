import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingEventId?: string;
}

export async function checkIdempotencyKey(
  _client: DynamoDBDocumentClient,
  _tableName: string,
  _projectId: string,
  _idempotencyKey: string,
): Promise<IdempotencyCheckResult> {
  // Phase 3: query relay-events by project_id + idempotency_key using a GSI
  return { isDuplicate: false };
}
