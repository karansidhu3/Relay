# EVENT_SYSTEM.md — Relay

## Event Naming Convention

All events follow the pattern: `{domain}.{entity}.{action}`

### Rules

1. **Lowercase only.** No camelCase, no PascalCase. `career.job.scored` not `Career.Job.Scored`.
2. **Dot-separated namespaces.** Three segments minimum: domain, entity, action.
3. **Past tense for completed facts.** `job.scored`, `document.generated`, `email.sent`.
4. **Present tense for requests.** `job.scoring.requested`, `document.generation.requested`.
5. **No verbs as the first segment.** The domain comes first.
6. **Segments are singular nouns or noun phrases.** `job` not `jobs`. `scoring.requested` not `score.requested`.

### Naming Examples

| ✅ Good | ❌ Bad |
|---|---|
| `career.job.scoring.requested` | `scoreJob` |
| `career.job.scored` | `Career.Job.Scored` |
| `marketmind.corpus.ingestion.started` | `start_corpus_ingestion` |
| `relay.execution.completed` | `relay_execution_completed` |
| `timekeep.clockevent.recorded` | `timeKeepClockEventRecorded` |

### Domain Registry

| Domain | Owner | Description |
|---|---|---|
| `career` | CareerOS | Job search and application automation |
| `marketmind` | MarketMind | Financial data and research platform |
| `timekeep` | TimeKeep | Workforce scheduling and time tracking |
| `relay` | Relay (internal) | Platform-level events emitted by Relay itself |

---

## Event Payload Structure

Every event published to Relay has two parts: the **envelope** (set by Relay) and the **payload** (set by the publisher).

### Canonical Event Envelope (stored in DynamoDB)

```typescript
interface RelayEvent {
  // Identity
  event_id: string;           // "evt_a1b2c3d4e5f6"
  idempotency_key?: string;   // Client-supplied dedup key

  // Routing
  project_id: string;         // "proj_careerOS"
  event_type: string;         // "career.job.scoring.requested"

  // State
  status: EventStatus;        // "RECEIVED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTERED"
  attempt_count: number;      // 0..N

  // Payload
  payload_ref: string;        // "inline:{json}" | "s3:{bucket}/{key}"
  payload_size_bytes: number;

  // Metadata
  metadata?: Record<string, string>;  // Publisher-supplied key-value pairs
  source_ip: string;
  api_key_id: string;

  // Timing
  created_at: string;         // ISO 8601
  updated_at: string;         // ISO 8601
  completed_at?: string;      // ISO 8601, nullable
}
```

### SQS Message (what goes on the queue)

The SQS message is intentionally minimal — the queue carries a reference, not the full payload. This:
- Keeps SQS message size small (well under 256KB limit)
- Ensures the DynamoDB record is the single source of truth
- Makes the Worker Lambda's behavior consistent (always fetches from DynamoDB)

```typescript
interface SQSMessageBody {
  event_id: string;
  event_type: string;
  project_id: string;
  attempt: number;
  enqueued_at: string;  // ISO 8601
}
```

---

## Application Event Catalog

### CareerOS Events

#### `career.job.ingested`
Emitted when a new job posting is stored in CareerOS.
```json
{
  "job_id": "job_abc123",
  "source": "adzuna",
  "title": "Senior Software Engineer",
  "company": "Stripe",
  "location": "Remote",
  "url": "https://...",
  "ingested_at": "2026-06-10T08:00:00.000Z"
}
```

#### `career.job.scoring.requested`
Emitted when a job should be scored against a candidate profile.
```json
{
  "job_id": "job_abc123",
  "resume_id": "res_xyz456",
  "candidate_id": "cand_789",
  "scoring_model": "claude-sonnet",
  "context": {
    "target_roles": ["Software Engineer", "Backend Engineer"],
    "preferred_stack": ["Python", "TypeScript", "AWS"]
  }
}
```

#### `career.document.generation.requested`
Emitted when a tailored resume or cover letter should be generated.
```json
{
  "job_id": "job_abc123",
  "candidate_id": "cand_789",
  "document_type": "cover_letter",
  "template_id": "tmpl_standard_v2",
  "customization_notes": "Emphasize AWS experience"
}
```

#### `career.digest.dispatch.scheduled`
Emitted by the scheduler for daily digest compilation and delivery.
```json
{
  "candidate_id": "cand_789",
  "period": "2026-06-10",
  "new_jobs_count": 14,
  "digest_type": "daily"
}
```

---

### MarketMind Events

#### `marketmind.corpus.ingestion.started`
Emitted when a new document batch is ready for processing.
```json
{
  "corpus_id": "corp_q2_2026",
  "document_count": 47,
  "source": "sec_filings",
  "s3_manifest": "s3://marketmind-uploads/corp_q2_2026/manifest.json",
  "ticker_symbols": ["AAPL", "MSFT", "NVDA"]
}
```

#### `marketmind.embedding.pipeline.requested`
Emitted when documents need to be chunked and embedded.
```json
{
  "corpus_id": "corp_q2_2026",
  "document_ids": ["doc_001", "doc_002"],
  "embedding_model": "text-embedding-3-small",
  "chunk_size": 512,
  "chunk_overlap": 64
}
```

#### `marketmind.signal.generation.requested`
Emitted when a trading signal should be derived from processed data.
```json
{
  "ticker": "NVDA",
  "signal_type": "sentiment",
  "corpus_ids": ["corp_q2_2026"],
  "window_days": 30
}
```

---

### TimeKeep Events

#### `timekeep.clockevent.recorded`
Emitted when an employee clocks in or out.
```json
{
  "employee_id": "emp_456",
  "business_id": "biz_mechanic_shop",
  "event_type": "clock_out",
  "timestamp": "2026-06-10T17:00:00.000Z",
  "location": "main_floor",
  "shift_id": "shift_789"
}
```

#### `timekeep.payroll.export.requested`
Emitted when a payroll export should be generated.
```json
{
  "business_id": "biz_mechanic_shop",
  "period_start": "2026-06-01",
  "period_end": "2026-06-14",
  "format": "csv",
  "employee_ids": ["emp_456", "emp_789"]
}
```

#### `timekeep.notification.dispatch.requested`
Emitted when a schedule or clock event notification should be sent.
```json
{
  "recipient_id": "emp_456",
  "channel": "sms",
  "template": "schedule_reminder",
  "variables": {
    "shift_start": "2026-06-11T09:00:00.000Z",
    "shift_duration_hours": 8
  }
}
```

---

### Relay Internal Events

These events are emitted by Relay itself. Applications can subscribe to them via webhook registration.

#### `relay.execution.completed`
```json
{
  "event_id": "evt_abc123",
  "execution_id": "exec_xyz789",
  "project_id": "proj_careerOS",
  "event_type": "career.job.scoring.requested",
  "duration_ms": 2141,
  "attempt": 1
}
```

#### `relay.execution.failed`
```json
{
  "event_id": "evt_abc123",
  "execution_id": "exec_xyz789",
  "event_type": "career.job.scoring.requested",
  "attempt": 2,
  "error_type": "TIMEOUT",
  "error_message": "Execution exceeded 30 second timeout",
  "will_retry": true,
  "next_attempt_at": "2026-06-10T09:00:09.000Z"
}
```

#### `relay.execution.dead_lettered`
```json
{
  "event_id": "evt_abc123",
  "event_type": "career.job.scoring.requested",
  "total_attempts": 3,
  "final_error": "TIMEOUT",
  "snapshot_ref": "s3://relay-snapshots/evt_abc123/snapshot.json",
  "dead_lettered_at": "2026-06-10T09:01:30.000Z"
}
```

---

## Workflow Execution Lifecycle

```
RECEIVED → QUEUED → PROCESSING → COMPLETED
                ↓                   ↓
             FAILED              (terminal)
                ↓
          (retry check)
                ↓
    [attempt < max] → re-enqueue → QUEUED
    [attempt >= max] → DEAD_LETTERED (terminal)
```

### State Definitions

| State | Description | Terminal? |
|---|---|---|
| `RECEIVED` | Event accepted by Ingest Lambda, written to DynamoDB | No |
| `QUEUED` | SQS message published, awaiting Worker Lambda | No |
| `PROCESSING` | Worker Lambda has claimed the message, execution running | No |
| `COMPLETED` | Execution finished successfully | Yes |
| `FAILED` | Execution failed, retry scheduled | No |
| `DEAD_LETTERED` | Max retries exhausted, in DLQ | Yes |

---

## Retry Lifecycle

```
Attempt 1 fails
    → Retry delay: 2s
Attempt 2 fails
    → Retry delay: 4s
Attempt 3 fails
    → No more retries
    → Message routed to DLQ
    → Status: DEAD_LETTERED
```

### Re-queue Mechanism

When the Worker Lambda catches a retriable error, it does not delete the SQS message. Instead:
1. It updates the execution record status to `FAILED`
2. It logs the error details
3. It throws the error (causing Lambda to return a failure)
4. SQS marks the message as failed and increments the receive count
5. After the visibility timeout, SQS makes the message available again

This means SQS manages the retry delay (via visibility timeout change) rather than the application sleeping and re-sending.

For exponential backoff: the Worker Lambda sets the SQS message visibility timeout before failing, using the AWS SDK `changeMessageVisibility` call. This defers the next visibility without deleting the message.

```typescript
// Before throwing the error in Worker Lambda
await sqs.changeMessageVisibility({
  QueueUrl: process.env.MAIN_QUEUE_URL,
  ReceiptHandle: message.receiptHandle,
  VisibilityTimeout: calculateDelay(attempt, config)  // 2s, 4s, 8s
});
```

---

## Failure Handling

### Error Classification

| Error Type | Description | Retry? |
|---|---|---|
| `TIMEOUT` | Lambda execution timeout | Yes |
| `RATE_LIMIT` | Downstream API rate limit | Yes |
| `TRANSIENT_ERROR` | Network errors, 5xx from dependencies | Yes |
| `VALIDATION_ERROR` | Payload doesn't match expected schema | No |
| `SCHEMA_ERROR` | Unknown event type, missing required fields | No |
| `UNAUTHORIZED` | Invalid credentials for downstream service | No |
| `NOT_FOUND` | Referenced resource no longer exists | No |
| `UNKNOWN` | Unclassified error | Yes (conservative default) |

### Error Classification Logic (Worker Lambda)

```typescript
function classifyError(error: Error): ErrorType {
  if (error.name === 'TimeoutError') return 'TIMEOUT';
  if (error.message.includes('rate limit') || error.status === 429) return 'RATE_LIMIT';
  if (error.status >= 500) return 'TRANSIENT_ERROR';
  if (error.status === 401 || error.status === 403) return 'UNAUTHORIZED';
  if (error.status === 404) return 'NOT_FOUND';
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  return 'UNKNOWN';
}
```

---

## Idempotency Strategy

Relay guarantees that processing an event twice produces the same result and does not cause side effects to execute twice.

### Mechanisms

**1. Client-supplied idempotency key**
Publishers can include an `idempotency_key` in the event. If Relay receives two events with the same `idempotency_key` from the same project, the second is treated as a duplicate and the original event is returned (`409 Conflict` with original event data).

Idempotency keys are checked in the `relay-events` table via a GSI on `project_id + idempotency_key`. Keys expire after 24 hours.

**2. Execution-level idempotency**
Before the Worker Lambda executes any workflow logic, it checks DynamoDB for an existing execution with status `COMPLETED` at the same `(event_id, attempt)`. If found, it skips execution and acknowledges the SQS message.

This handles the SQS at-least-once delivery case: if a Lambda processes a message successfully but crashes before acknowledging, SQS will redeliver the message. The execution check prevents double processing.

**3. Workflow handler idempotency**
Individual workflow handlers are responsible for their own downstream idempotency. For example, the job scoring handler checks if a score already exists for `(job_id, resume_id)` before invoking the Claude API. This is documented as a requirement in the workflow handler interface.

---

## Event Versioning

Event schemas evolve. Relay handles this through explicit versioning in the event type:

`career.job.scoring.requested` → `career.job.scoring.requested.v2` (when schema changes)

**Rules:**
- Additive changes (new optional fields) do not require version bumps
- Breaking changes (removed fields, changed field types) require a new version
- Relay stores the raw payload as received — the Worker Lambda is responsible for handling version differences
- Old versions are deprecated with a 30-day notice window

This mirrors the versioning strategy used by Stripe's webhook events.
