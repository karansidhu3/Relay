# CLAUDE.md — Relay

You are the implementation engineer for Relay, an internal infrastructure platform. This file is your engineering constitution. Read it before writing code. Apply it consistently. Do not deviate from it without explicit instruction.

---

## Project Identity

Relay is an infrastructure platform, not a business application. It handles events, queues, retries, and observability. It is built for correctness, reliability, and operational clarity — not for end-user delight.

Every engineering decision should be evaluated against this question: **Does this make the system more correct, more visible, or more maintainable? Or is it complexity for its own sake?**

---

## Architecture Principles

### 1. Serverless-first
Lambda is the execution environment for all backend logic. Do not introduce always-on compute (EC2, ECS tasks, long-running processes) without an explicit architectural reason. There are none in this project.

### 2. SQS as the spine
All async work flows through SQS. Do not invent alternative async mechanisms (HTTP polling loops, in-process queues, cron hacks). SQS handles durability, retry signaling, and DLQ routing natively.

### 3. DynamoDB for state
All event and execution state lives in DynamoDB. Do not introduce a second database for the backend worker layer. Do not attempt to use Supabase/PostgreSQL for Lambda workers — connection pooling in Lambda is a known operational hazard.

### 4. Event ID is the primary trace key
`event_id` threads through every system: DynamoDB records, SQS messages, CloudWatch logs, S3 paths, API responses. Every log line that relates to an event must include `event_id`. This is non-negotiable.

### 5. Fail loudly, recover gracefully
Execution failures should be fully logged before any recovery path is taken. Silent failures are the worst failure mode in an infrastructure system. Log first, classify, retry or DLQ.

### 6. Idempotency is a first-class constraint
Every workflow handler must be safe to call twice with the same input. Check DynamoDB before executing side effects. This is not optional — SQS delivers at-least-once, and Lambda can crash after processing but before acknowledging.

---

## Engineering Standards

### TypeScript

- `strict: true` in all `tsconfig.json` files. No exceptions.
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it explicitly.
- No `as` type assertions unless accompanied by a comment explaining why it is safe.
- Prefer interfaces for object shapes, types for unions/aliases.
- All function parameters and return types must be explicitly typed.
- Prefer named exports over default exports in library code.
- Use default exports only for Next.js pages and route handlers (framework convention).

```typescript
// ✅ Correct
interface IngestEvent {
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

async function publishToSQS(event: IngestEvent): Promise<void> { ... }

// ❌ Wrong
async function publishToSQS(event: any) { ... }
```

### Naming Conventions

**Variables and functions:** camelCase
```typescript
const eventId = 'evt_abc123';
async function fetchEventById(eventId: string): Promise<RelayEvent> { ... }
```

**Types and interfaces:** PascalCase
```typescript
interface RelayEvent { ... }
type EventStatus = 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTERED';
```

**Constants:** SCREAMING_SNAKE_CASE
```typescript
const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;
```

**DynamoDB table names:** kebab-case strings in environment variables
```
EVENTS_TABLE=relay-events
EXECUTIONS_TABLE=relay-executions
```

**S3 keys:** forward-slash path with event_id as the segment
```
relay-payloads/{project_id}/{event_id}/payload.json
```

**Lambda function names:** kebab-case
```
relay-ingest
relay-worker
relay-dlq-handler
```

**Event types:** dot-notation, lowercase, domain.entity.action
```
career.job.scoring.requested
marketmind.corpus.ingestion.started
relay.execution.completed
```

**IDs:** prefixed strings
```
evt_{uuid}
exec_{uuid}
proj_{slug}
wf_{uuid}
aud_{uuid}
```

### File Structure

```
packages/relay-api/
├── src/
│   ├── handlers/               # Lambda handler entry points (one file per function)
│   │   ├── ingest.ts
│   │   ├── worker.ts
│   │   ├── dlq-handler.ts
│   │   ├── scheduler.ts
│   │   └── api-read.ts
│   ├── workflows/              # Workflow handler implementations (one file per event type domain)
│   │   ├── career.ts
│   │   ├── marketmind.ts
│   │   └── timekeep.ts
│   ├── services/               # AWS service clients (DynamoDB, SQS, S3)
│   │   ├── dynamo.ts
│   │   ├── sqs.ts
│   │   └── s3.ts
│   ├── lib/                    # Shared utilities
│   │   ├── logger.ts           # Structured logger
│   │   ├── errors.ts           # Error types and classification
│   │   ├── retry.ts            # Backoff calculation
│   │   ├── idempotency.ts      # Idempotency check helpers
│   │   └── validate.ts         # Input validation helpers
│   └── types/
│       └── relay.ts            # Shared TypeScript interfaces
```

**Rules:**
- One concern per file. Handler files only contain the Lambda handler function. Business logic belongs in `workflows/` or `lib/`.
- No circular imports. `handlers/` → `workflows/` → `services/` → `lib/`. One direction only.
- No barrel files (`index.ts` that re-exports everything). Import directly from the source file.

---

## Coding Conventions

### Lambda Handlers

Every Lambda handler follows this structure:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../lib/logger';
import { successResponse, errorResponse } from '../lib/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId ?? 'unknown';
  
  logger.info('Handler invoked', { requestId, path: event.path });

  try {
    // Business logic here
    return successResponse(202, { eventId: 'evt_abc' });
  } catch (error) {
    logger.error('Handler failed', { requestId, error });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unexpected error occurred');
  }
};
```

**Rules:**
- Always destructure the request context for `requestId` — it links Lambda logs to API Gateway logs.
- Always wrap in try/catch at the handler level. Uncaught errors produce unstructured Lambda error logs.
- Return the response envelope using `successResponse()` and `errorResponse()` helpers — never inline the JSON shape.
- Never return sensitive data (stack traces, internal error messages) to the API caller. Log it; do not surface it.

### Error Handling

```typescript
// Define error types explicitly
class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class IdempotencyConflictError extends Error {
  constructor(public readonly existingEventId: string) {
    super(`Event with this idempotency key already exists: ${existingEventId}`);
    this.name = 'IdempotencyConflictError';
  }
}

// Classify errors; never swallow them
function classifyError(error: unknown): ErrorType {
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  if (error instanceof IdempotencyConflictError) return 'DUPLICATE';
  if (error instanceof Error && error.message.includes('rate limit')) return 'RATE_LIMIT';
  return 'UNKNOWN';
}
```

**Rules:**
- Never `catch(e) { return null; }`. Either handle the error explicitly or rethrow it.
- Never throw raw `Error` objects from business logic. Use named error subclasses.
- `UNKNOWN` error type triggers retry by default — conservative but correct.

### Async/Await

- Always `await` Promises. Never `.then()` chains in new code.
- Always `try/catch` around AWS SDK calls. They can fail in unexpected ways (transient network errors, throttling).
- Do not use `Promise.all()` for sequential operations that depend on each other. Use `await` in sequence.
- Use `Promise.all()` for genuinely parallel independent operations (e.g., fetching event from DynamoDB and workflow config simultaneously).

### Environment Variables

```typescript
// ✅ Correct — validate at startup, fail fast
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

const config = {
  eventsTable: getRequiredEnv('EVENTS_TABLE'),
  mainQueueUrl: getRequiredEnv('MAIN_QUEUE_URL'),
  payloadBucket: getRequiredEnv('PAYLOAD_BUCKET'),
};

// ❌ Wrong — fails silently at runtime
const table = process.env.EVENTS_TABLE || '';
```

Never hardcode ARNs, table names, or queue URLs in code. Always from environment variables.

---

## Logging Standards

All logging uses the structured logger in `lib/logger.ts`. This logger outputs JSON to stdout.

```typescript
// ✅ Correct — structured with context
logger.info('Execution completed', {
  event_id: 'evt_abc123',
  execution_id: 'exec_xyz',
  duration_ms: 2141,
  attempt: 1
});

// ❌ Wrong — unstructured, unsearchable
console.log(`Execution completed for event ${eventId} in ${duration}ms`);
```

**Logging rules:**
- `console.log` is banned. Use `logger.*` exclusively.
- Every log line must include `event_id` if one is in scope.
- Log `INFO` at the start and end of every execution.
- Log `ERROR` before every throw or failure path.
- Never log sensitive data: API keys, full request bodies (log `payload_size_bytes` instead), user PII.
- Log stack traces on `ERROR` level only. Truncate at 2KB.

**Required log points in every Worker execution:**
1. `Execution started` — with event_id, event_type, attempt number
2. Any significant internal step (e.g., API call initiated)
3. `Execution completed` — with duration_ms, status
4. `Execution failed` — with error_type, error_message, will_retry boolean

---

## API Standards

- All responses use the standard envelope: `{ success, data, meta: { request_id, timestamp } }`
- HTTP status codes are meaningful: 202 for queued work, 200 for completed reads, 409 for idempotency conflicts, 429 for rate limits
- Error codes are SCREAMING_SNAKE_CASE strings in the response body
- Never return 200 with `{ success: false }`. Use the appropriate error status code.
- API routes are kebab-case: `/dead-letter-queue`, not `/deadLetterQueue`
- Query parameters are snake_case: `?event_type=`, `?project_id=`

---

## DynamoDB Access Patterns

- All DynamoDB access goes through `services/dynamo.ts`. No direct AWS SDK calls in handlers or workflows.
- Use `GetCommand`, `PutCommand`, `UpdateCommand`, `QueryCommand` — not legacy DocumentClient patterns.
- Always include `ConditionExpression` when writing to prevent blind overwrites (e.g., `attribute_not_exists(event_id)` on initial event write).
- Never perform table scans. Every query must use a primary key or GSI.
- Batch writes use `BatchWriteCommand`. Max 25 items per batch.
- All timestamps are ISO 8601 strings. Use `new Date().toISOString()`.

---

## SQS Patterns

- SQS messages contain only `event_id`, `event_type`, `project_id`, `attempt`, `enqueued_at`. Full payload is always fetched from DynamoDB.
- Batch size for Worker Lambda SQS trigger: `1`. Processing one message per invocation maximizes retry granularity and simplifies error handling.
- Acknowledgment: delete the SQS message only after successful processing. Do not catch errors and return 200 to SQS — let the Lambda fail, let SQS handle retry.
- Visibility timeout extension: use `ChangeMessageVisibilityCommand` before throwing retry errors to implement exponential backoff.

---

## Testing Expectations

### What must be tested
- Input validation logic (pure functions, easy to unit test)
- Error classification logic
- Retry delay calculation (backoff math)
- Idempotency check logic
- Response envelope construction

### What is tested via integration
- DynamoDB read/write operations
- SQS message publish/receive
- End-to-end event lifecycle

### What is not tested (and why)
- AWS SDK internals (they are AWS's responsibility)
- Lambda handler wiring (tested via `sam local invoke`)
- CloudWatch log formatting (tested via visual inspection)

### Test framework
- **Unit tests:** Vitest (fast, TypeScript-native, no configuration overhead)
- **Integration tests:** `sam local invoke` with test event JSON files in `tests/events/`
- **No mocking of DynamoDB or SQS in unit tests** — mock the service abstraction layer, not AWS SDK directly

### Test file location
`src/__tests__/{module-name}.test.ts` — colocated with source, not in a separate `tests/` directory.

---

## Documentation Expectations

### Code-level
- Every exported function must have a JSDoc comment explaining what it does, not how.
- Complex business logic gets inline comments explaining *why*, not *what*.
- AWS resource ARNs and environment variable names referenced in code get a comment linking to the SAM template.

### Architecture-level
- This `CLAUDE.md` is the living engineering spec. It is updated when decisions change.
- `SYSTEM_ARCHITECTURE.md` explains the system. It is not updated for implementation details.
- `API_SPEC.md` is updated when endpoints change. It is the contract between frontend and backend.

### ADRs (Architectural Decision Records)
Any significant decision that differs from the stated architecture gets an ADR entry in `/docs/adr/`. Format:
```
# ADR-001: Why we chose X instead of Y
Status: Accepted
Date: 2026-06-10
Context: ...
Decision: ...
Consequences: ...
```

---

## Anti-Patterns to Avoid

### ❌ Fake scale architecture
Do not add Redis, Kafka, Elasticsearch, or Kubernetes for "scale." This is a portfolio project with tens of events per day. The architecture is designed for believable sophistication — not enterprise fantasy.

### ❌ Magic strings
No raw strings for event types, status values, DynamoDB table names, or error codes in business logic. Use constants or TypeScript union types.

```typescript
// ❌ Wrong
if (status === 'completed') { ... }

// ✅ Correct
const EventStatus = {
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
if (status === EventStatus.COMPLETED) { ... }
```

### ❌ God objects
No `RelayService` class that does everything. Functions are organized by concern (ingest, retry, workflow dispatch) and kept small.

### ❌ Unused abstractions
Do not create a base class or interface unless there are at least two implementations that need it. Abstraction is earned, not assumed.

### ❌ Logging in catch before rethrowing
```typescript
// ❌ Wrong — logs duplicate on every catch level
try { ... } catch(e) {
  logger.error('Failed', e);
  throw e;  // will be logged again upstream
}

// ✅ Correct — log once at the boundary where the error is handled
try { ... } catch(e) {
  throw new WorkflowExecutionError('Scoring failed', { cause: e });
}
// Log at the Worker Lambda level where it's caught and decided upon
```

### ❌ Synchronous heavy work in Ingest Lambda
The Ingest Lambda must return in under 3 seconds. Any work that could take longer (calling external APIs, heavy computation) must be deferred to the Worker Lambda via SQS. The Ingest Lambda validates, stores, and queues — nothing more.

### ❌ Hardcoded retry counts
Retry configuration lives in DynamoDB `relay-workflows` per event type. It is never hardcoded in the Worker Lambda.

### ❌ Overloaded error handling
If an error occurs in a workflow handler, it propagates up to the Worker Lambda which classifies and handles it. Workflow handlers do not implement their own retry loops — that is the Worker's job.

---

## Cost-Awareness Principles

Every DynamoDB query costs money (fractions of a cent, but compound over time). Every S3 PUT costs money. Design queries to be precise:

- Always project only the attributes you need in DynamoDB queries (`ProjectionExpression`)
- Never query DynamoDB in a loop without batching
- Large payloads go to S3, not DynamoDB items (DynamoDB charges per KB read/written)
- CloudWatch custom metrics cost $0.30/metric/month after 10 metrics — emit only meaningful metrics

When in doubt: free tier first, optimization second, complexity last.

---

## Commit Philosophy

Commits are small, atomic, and described in the present tense imperative:

```
Add idempotency check to Ingest Lambda
Fix retry delay calculation for RATE_LIMIT errors
Update DynamoDB execution record on COMPLETED status
Add structured logging to Worker Lambda
```

Not:
```
Fixed stuff
WIP
Updates
```

Each commit should leave the codebase in a deployable state. Feature branches are merged via PR even when working solo — the PR description is documentation.

---

## When to Stop and Ask

**Stop and ask the human before proceeding if:**

1. An AWS resource needs to be created that requires a human action (account setup, billing, IAM user creation)
2. An environment variable is required but not yet available
3. A decision has meaningful tradeoffs between two reasonable approaches
4. The implementation would require more than ~300 lines of new code without a clear prior decision supporting it
5. An external service integration is needed (Twilio, Resend, Claude API) and credentials are not available

**Do not stop to ask about:**
- Standard implementation of patterns already documented here
- Minor TypeScript decisions (type choice, naming within the conventions above)
- Which of two equivalent utility implementations to use
- CloudWatch log formatting decisions

---

## The Prime Directive

Build the simplest thing that correctly solves the stated problem. Every line of code is a liability. Code that does not exist cannot have bugs. If you are about to add something and cannot clearly state which documented requirement it satisfies, do not add it.

Relay is infrastructure. It is judged on correctness, observability, and reliability — not on feature count.
