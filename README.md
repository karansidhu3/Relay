# Relay

Serverless event orchestration and observability platform. Applications publish events via REST API; Relay queues, processes, retries, and surfaces execution state in a real-time dashboard.

Built on AWS Lambda, SQS, DynamoDB, and S3 — deployed via AWS SAM. Dashboard on Vercel (Next.js 14 App Router).

**Live dashboard:** https://relay-dashboard.vercel.app  
**API base URL:** `https://eba0ihdlc2.execute-api.us-east-1.amazonaws.com/prod`

---

## Architecture

```
Client App
    │
    ▼
API Gateway ──► Lambda (Ingest) ──► DynamoDB (relay-events)
                                ──► SQS (relay-main-queue)
                                         │
                                         ▼
                                  Lambda (Worker) ──► Workflow handler
                                         │               └─ career.job.scoring.requested
                                         │               └─ timekeep.clockevent.recorded
                                         │               └─ marketmind.corpus.ingestion.started
                                         │               └─ … (10 event types)
                                         ▼
                                  DynamoDB (relay-executions)
                                  S3 (relay-payloads)
                                         │
                                    [on failure × 3]
                                         ▼
                                  SQS (relay-dlq)
                                         │
                                         ▼
                                  Lambda (DLQ Handler) ──► S3 (relay-snapshots)
                                                       ──► DynamoDB status → DEAD_LETTERED
                                                       ──► CloudWatch alarm → SNS → Email
```

## Packages

| Package | Description |
|---|---|
| `packages/relay-api` | Lambda functions: Ingest, Worker, DLQ Handler, Scheduler, API Read |
| `packages/relay-dashboard` | Next.js 14 observability dashboard (Vercel) |
| `packages/relay-client` | TypeScript SDK for publishing events from other applications |

## Key properties

**Idempotent** — every workflow handler is safe to call twice with the same input. Execution records are keyed by `event_id + attempt`.

**At-least-once delivery** — SQS delivers at-least-once; the Worker checks for an existing execution record before processing.

**Exponential backoff** — failed executions extend SQS visibility timeout before re-delivery: 2 s, 4 s, 8 s. After 3 attempts the message routes to the DLQ.

**Structured logging** — every Lambda emits JSON to CloudWatch. Every log line in scope of an event includes `event_id`.

## Setup

### Prerequisites

- Node.js 22+
- AWS CLI configured (`aws configure`)
- AWS SAM CLI (`brew install aws-sam-cli`)

### Install

```bash
npm install
```

### Typecheck

```bash
npm run typecheck
```

### Deploy (manual)

```bash
cd infrastructure
sam build
sam deploy
```

### Deploy (CI/CD)

Merges to `main` trigger automatic deploy via GitHub Actions (`.github/workflows/deploy.yml`).

Add two secrets to the GitHub repository:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key with Lambda/DynamoDB/SQS/S3/CloudFormation access |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret key |

## Publishing an event

```typescript
import { RelayClient } from '@relay/client';

const relay = new RelayClient({
  apiKey: process.env.RELAY_API_KEY,
  projectId: 'proj_careeeros',
});

const result = await relay.publish({
  eventType: 'career.job.scoring.requested',
  payload: {
    job_id: 'job_abc123',
    resume_id: 'res_xyz456',
    candidate_id: 'cand_789',
  },
  idempotencyKey: 'job_abc123-scoring-v1',
});

console.log(result.eventId); // evt_…
```

Or directly via curl:

```bash
curl -X POST https://eba0ihdlc2.execute-api.us-east-1.amazonaws.com/prod/events \
  -H "Content-Type: application/json" \
  -H "x-relay-api-key: rlk_test_9b613d27a0bb8e29750ee7cfc655a87c" \
  -d '{
    "event_type": "career.job.scoring.requested",
    "payload": { "job_id": "job_001", "resume_id": "res_001", "candidate_id": "cand_001" }
  }'
```

## Registered projects

| Project ID | Name | Allowed event types |
|---|---|---|
| `proj_careeeros` | CareerOS | `career.job.ingested`, `career.job.scoring.requested`, `career.document.generation.requested`, `career.digest.dispatch.scheduled` |
| `proj_marketmind` | MarketMind | `marketmind.corpus.ingestion.started`, `marketmind.embedding.pipeline.requested`, `marketmind.signal.generation.requested` |
| `proj_timekeep` | TimeKeep | `timekeep.clockevent.recorded`, `timekeep.payroll.export.requested`, `timekeep.notification.dispatch.requested` |

## Security

- All S3 buckets have public access blocked
- IAM roles are least-privilege: each Lambda has only the DynamoDB/SQS/S3 actions it needs, scoped to specific resource ARNs
- API key authentication on all ingest endpoints (`x-relay-api-key` header)
- Keys are stored as bcrypt hashes in DynamoDB — plaintext never persisted
- CORS allows all origins (`*`) — acceptable because all state-changing endpoints require API key authentication, making CSRF irrelevant

## Docs

- [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) — full architecture detail
- [`API_SPEC.md`](API_SPEC.md) — REST API reference
- [`EVENT_SYSTEM.md`](EVENT_SYSTEM.md) — event type catalog and payload schemas
- [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) — DynamoDB schema and access patterns
- [`OBSERVABILITY_SYSTEM.md`](OBSERVABILITY_SYSTEM.md) — logging, metrics, and alerting
- [`AWS_INFRASTRUCTURE.md`](AWS_INFRASTRUCTURE.md) — SAM infrastructure detail
- [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md) — phased build plan
