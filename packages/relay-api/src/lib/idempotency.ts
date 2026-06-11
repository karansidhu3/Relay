// Idempotency key lookup is implemented in services/dynamo.ts (getEventByIdempotencyKey).
// This file retains the result interface for use across the codebase.

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingEventId?: string;
}
