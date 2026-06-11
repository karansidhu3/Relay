# SYSTEM_ARCHITECTURE.md — Relay

## Architecture Overview

Relay is a serverless-first, event-driven infrastructure platform. It is built entirely on AWS managed services — no always-on compute, no cluster management, no persistent servers.

The core data flow is:

```
Application → API Gateway → Lambda (Ingest) → SQS → Lambda (Worker) → DynamoDB + S3 + CloudWatch
                                                           ↓
                                                    Dead-Letter Queue
                                                           ↓
                                                    Lambda (DLQ Handler)
```

Every layer is managed, auto-scaling, and pay-per-use. At portfolio-scale volume, the entire platform runs within AWS free tier limits.

---

## Component Responsibility Map

| Component | Role |
|---|---|
| API Gateway | Public entry point. Routes ingest, webhook, and management requests to Lambda |
| Lambda (Ingest) | Validates incoming events, normalizes payloads, writes to DynamoDB, publishes to SQS |
| SQS Standard Queue | Durable event queue. Buffers jobs between ingest and processing |
| Lambda (Worker) | Consumes SQS messages. Executes workflow logic. Writes execution logs |
| SQS Dead-Letter Queue | Receives messages that fail processing after max retry attempts |
| Lambda (DLQ Handler) | Monitors DLQ, updates execution status, triggers alerts |
| DynamoDB | Stores events, executions, retry state, and workflow metadata |
| S3 | Stores large event payloads and execution artifacts |
| CloudWatch | Logs all Lambda executions. Powers metrics, alarms, and dashboards |
| EventBridge (optional) | Handles cron-scheduled workflow triggers |
| Vercel | Hosts the Next.js observability dashboard |

---

## Event Lifecycle

### 1. Publication
An application (CareerOS, MarketMind, TimeKeep) calls `POST /events` on the Relay API with a structured event payload.

### 2. Ingestion
The Ingest Lambda:
- Validates the event schema
- Assigns a globally unique `event_id` (UUID v4)
- Normalizes the payload to the Relay event envelope format
- Writes the event record to DynamoDB with status `RECEIVED`
- If payload exceeds 256KB, offloads to S3 and stores the S3 reference
- Publishes a lightweight message to SQS (contains `event_id`, not full payload)
- Returns `202 Accepted` with the `event_id`

### 3. Queuing
SQS holds the message durably. Visibility timeout is configured per queue. If the Worker Lambda does not acknowledge processing within the timeout window, SQS makes the message available again (this is the first retry mechanism).

### 4. Processing
The Worker Lambda is triggered by SQS. It:
- Reads the `event_id` from the SQS message
- Fetches the full event payload from DynamoDB (and S3 if needed)
- Checks idempotency: if `execution_id` already exists for this event, skips processing
- Creates an execution record in DynamoDB with status `RUNNING`
- Executes the workflow handler for the event type
- On success: updates execution to `COMPLETED`, logs metrics
- On failure: updates execution to `FAILED`, increments retry counter

### 5. Retry
Retry logic operates at two levels:

**Level 1 — SQS Native Retry:**
SQS automatically makes unacknowledged messages visible again after the visibility timeout. This handles transient Lambda failures (crashes, timeouts) without any application code.

**Level 2 — Application-Level Retry:**
For caught exceptions, the Worker Lambda uses exponential backoff logic before returning a failure. Configurable per event type: max attempts (default 3), base delay (default 2s), multiplier (default 2x).

### 6. Dead-Letter Queue
After `maxReceiveCount` failures (default: 3), SQS routes the message to the Dead-Letter Queue. The DLQ Handler Lambda:
- Reads the message
- Updates the execution record to `DEAD_LETTERED`
- Writes a detailed failure snapshot to S3
- Publishes a `relay.execution.dead_lettered` internal event
- Optionally triggers a CloudWatch alarm

### 7. Completion
Final execution state is written to DynamoDB. Full execution log (input, output, error if any, timing) is written to CloudWatch. The dashboard reflects the updated state.

---

## Queue Architecture

### Main Processing Queue
- **Type:** SQS Standard Queue (not FIFO)
- **Visibility timeout:** 30 seconds (configurable per event type via message attribute)
- **Message retention:** 4 days
- **maxReceiveCount:** 3 (before DLQ routing)
- **Reasoning:** Standard queue is sufficient. We do not require strict ordering. FIFO queues cost 3x more and add unnecessary constraints.

### Dead-Letter Queue
- **Type:** SQS Standard Queue
- **Message retention:** 14 days (maximum)
- **Trigger:** Automatic via main queue redrive policy
- **Processing:** Lambda trigger on DLQ message arrival

### Why SQS Over Redis/BullMQ/Others
At portfolio scale, SQS provides:
- Zero operational overhead (no Redis instance to manage)
- Native AWS retry and DLQ semantics
- CloudWatch metrics out of the box
- Near-zero cost at free tier
- Deep integration with Lambda triggers

Redis-based queues (BullMQ, Celery) require an always-on instance (minimum ~$15-20/month on ElastiCache or self-managed EC2). This cost is unjustified for a portfolio project and adds ops overhead that obscures the actual architecture being demonstrated.

---

## Retry Strategy

### Retry Configuration (per event type, stored in DynamoDB)
```
{
  "max_attempts": 3,
  "base_delay_ms": 2000,
  "backoff_multiplier": 2.0,
  "max_delay_ms": 30000,
  "retry_on": ["TIMEOUT", "RATE_LIMIT", "TRANSIENT_ERROR"],
  "no_retry_on": ["VALIDATION_ERROR", "SCHEMA_ERROR", "UNAUTHORIZED"]
}
```

### Retry Attempt Sequence (default config)
| Attempt | Delay Before Retry |
|---|---|
| 1st retry | 2 seconds |
| 2nd retry | 4 seconds |
| 3rd retry | 8 seconds |
| → DLQ | — |

### Idempotency
Every execution is keyed on `(event_id, attempt_number)`. Before executing any workflow, the Worker checks DynamoDB for an existing execution with `COMPLETED` status. If found, it skips execution and acknowledges the SQS message. This prevents double-processing caused by SQS at-least-once delivery guarantees.

---

## Dead-Letter Queue Handling

DLQ messages represent permanently failed executions — they have exhausted retries and need human review.

The DLQ Handler Lambda does the following:
1. Parses the original message and retrieves the execution record
2. Writes a `FailureSnapshot` to S3: full event payload, all attempt logs, error messages, stack traces
3. Updates execution status to `DEAD_LETTERED` in DynamoDB
4. Emits a `relay.execution.dead_lettered` event (internal, for dashboard alerting)
5. Triggers a CloudWatch metric increment on `DeadLetteredExecutions`

DLQ messages are retained for 14 days. The dashboard exposes a DLQ review interface with re-queue capability for manual recovery.

---

## Storage Decisions

### DynamoDB (Primary Store)
Used for: events, executions, retry state, workflow configs, project/application metadata.

**Why DynamoDB over Supabase/PostgreSQL here:**
- Native Lambda integration (no connection pooling issues)
- Serverless billing model (free tier: 25GB, 200M requests/month)
- No cold start connection overhead
- Simpler ops at this scale

**Why not Supabase for Relay's backend:**
Supabase is excellent for Folio and CareerOS (rich relational queries, auth, realtime). For Relay's backend worker layer, DynamoDB is a better fit — it's optimized for high-throughput key-value access patterns (lookup by `event_id`, `execution_id`, `project_id`), has no connection limits to worry about in Lambda, and stays entirely within the AWS ecosystem.

The Relay dashboard frontend (Next.js) queries a thin read API (also Lambda) which can return pre-aggregated data. Complex analytics don't need a relational DB at this scale.

### S3 (Payload and Artifact Store)
Used for:
- Event payloads larger than 256KB (SQS message body limit is 256KB; DynamoDB item limit is 400KB)
- Execution artifacts (large outputs, generated documents)
- DLQ failure snapshots
- Execution log archives

Naming convention: `relay-payloads/{project_id}/{event_id}/payload.json`

S3 free tier: 5GB storage, 20,000 GET, 2,000 PUT requests/month.

### CloudWatch Logs (Execution Logs)
Every Lambda execution produces structured JSON logs to CloudWatch. Log groups are organized by service:
- `/relay/ingest`
- `/relay/worker`
- `/relay/dlq-handler`
- `/relay/scheduler`

Log retention: 30 days (configurable). CloudWatch free tier: 5GB ingestion/month.

---

## Serverless Reasoning

Relay uses Lambda everywhere processing logic runs. This is not a default choice — it is the right choice for this project for these reasons:

1. **Cost.** Lambda free tier: 1M invocations/month + 400,000 GB-seconds compute. A portfolio-scale platform will never exceed this. An EC2 instance costs money every hour, running or not.

2. **Scaling.** Lambda scales to zero when idle and to hundreds of concurrent executions under load. No capacity planning required.

3. **Ops overhead.** No AMIs to maintain, no OS patches, no SSH access required. The code is the infrastructure.

4. **Coherence with SQS.** Lambda + SQS is a native AWS integration — SQS triggers Lambda automatically, handles concurrency, manages batch sizes. This is how AWS expects these services to be used together.

5. **Portfolio signal.** Understanding Lambda cold starts, execution limits, memory configuration, and event source mapping is valuable cloud engineering knowledge. Using it deliberately demonstrates that knowledge.

---

## Scaling Considerations

At portfolio scale, scaling is not a problem. The architecture is documented here for completeness and to demonstrate awareness of production concerns.

**SQS → Lambda scaling:**
Lambda event source mapping scales Lambda concurrency based on SQS queue depth. AWS will add Lambda instances up to the configured concurrency limit. Default concurrency limit for free-tier: 1000 concurrent executions across the account.

**DynamoDB scaling:**
DynamoDB on-demand mode scales reads/writes automatically. No capacity planning required. Free tier covers 200M requests/month.

**Cold starts:**
Lambda cold starts are a real concern for latency-sensitive workloads. For Relay's async processing, cold starts are acceptable — a 300-500ms cold start is irrelevant when the job is already in a queue. The ingest Lambda (user-facing, synchronous) should be monitored for cold start latency.

**Future scaling levers** (not implemented now, worth knowing):
- Lambda Provisioned Concurrency (eliminates cold starts, costs money)
- SQS FIFO queues (ordering guarantees, 3x cost)
- DynamoDB Global Tables (multi-region, not needed)
- Lambda Layers (shared dependencies, reduces package size)

---

## Cost Minimization Reasoning

The full platform should cost **$0/month** under normal portfolio usage.

| Service | Free Tier | Expected Usage |
|---|---|---|
| Lambda | 1M invocations, 400K GB-sec | < 10K invocations/month |
| SQS | 1M requests/month | < 50K requests/month |
| DynamoDB | 25GB storage, 200M requests | < 100MB, < 100K requests |
| S3 | 5GB storage, 20K GET, 2K PUT | < 100MB, < 1K requests |
| CloudWatch | 5GB logs, 3 dashboards | < 1GB logs |
| API Gateway | 1M REST API calls/month | < 10K calls/month |

**What would break the free tier:**
- Sustained high-volume traffic (hundreds of events per minute)
- Large S3 payloads in bulk
- CloudWatch metric math queries at high frequency

None of these apply to a portfolio project.

**Cost monitoring:** A CloudWatch billing alarm is set at $1 to catch any unexpected charges early.
