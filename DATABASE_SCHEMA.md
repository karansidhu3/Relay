# DATABASE_SCHEMA.md — Relay

## Data Storage Strategy

Relay uses DynamoDB as its primary data store. DynamoDB is a key-value / document database — it excels at the access patterns Relay requires (fast lookups by ID, simple status updates, append-only execution logs) and integrates natively with Lambda at zero operational overhead.

This document defines every table, its schema, its access patterns, and its indexing strategy.

---

## Design Principles

1. **Design for access patterns, not normalization.** DynamoDB is not a relational database. Schema decisions are driven by how data is queried, not by avoiding redundancy.

2. **Single-table design considered and rejected.** Single-table DynamoDB design reduces costs and complexity at extreme scale. At portfolio scale, multiple tables are clearer, easier to reason about, and easier to explain. The tradeoff is acceptable.

3. **Attribute names are human-readable.** No cryptic shorthand. `event_type`, not `et`. DynamoDB storage cost is irrelevant at this scale.

4. **All IDs are prefixed strings.** `evt_`, `exec_`, `proj_`, `wf_`. This makes debug logs instantly readable without schema lookups.

5. **Timestamps are ISO 8601 strings.** DynamoDB does not have a native timestamp type. ISO 8601 strings sort lexicographically correctly.

---

## Table: `relay-events`

Stores the canonical record for every event received by Relay.

### Schema

| Attribute | Type | Description |
|---|---|---|
| `event_id` | String (PK) | Unique event identifier: `evt_{uuid}` |
| `project_id` | String | Source application identifier |
| `event_type` | String | Event name: `career.job.scoring.requested` |
| `status` | String | `RECEIVED` \| `QUEUED` \| `PROCESSING` \| `COMPLETED` \| `FAILED` \| `DEAD_LETTERED` |
| `payload_ref` | String | `inline:{json}` or `s3:{bucket}/{key}` |
| `payload_size_bytes` | Number | Size of original payload |
| `source_ip` | String | IP of publisher (for audit) |
| `api_key_id` | String | API key used to submit event |
| `idempotency_key` | String | Optional client-supplied dedup key |
| `attempt_count` | Number | Total processing attempts made |
| `created_at` | String | ISO 8601 timestamp |
| `updated_at` | String | ISO 8601 timestamp |
| `completed_at` | String | ISO 8601 timestamp (nullable) |
| `metadata` | Map | Optional arbitrary key-value metadata from publisher |

### Global Secondary Indexes

**GSI-1: `project-created-index`**
- Partition key: `project_id`
- Sort key: `created_at`
- Used for: Dashboard queries — "show me all events for CareerOS in the last 24 hours"

**GSI-2: `status-updated-index`**
- Partition key: `status`
- Sort key: `updated_at`
- Used for: Dashboard queries — "show me all failed events"

**GSI-3: `type-created-index`**
- Partition key: `event_type`
- Sort key: `created_at`
- Used for: Throughput analytics — "how many scoring requests happened today?"

### Example Item
```json
{
  "event_id": "evt_a1b2c3d4e5f6",
  "project_id": "proj_careerOS",
  "event_type": "career.job.scoring.requested",
  "status": "COMPLETED",
  "payload_ref": "inline:{\"job_id\":\"job_xyz\",\"resume_id\":\"res_abc\"}",
  "payload_size_bytes": 512,
  "source_ip": "142.250.1.1",
  "api_key_id": "key_careerOS_prod",
  "idempotency_key": "career-job-xyz-scoring-attempt-1",
  "attempt_count": 1,
  "created_at": "2026-06-10T09:00:00.000Z",
  "updated_at": "2026-06-10T09:00:03.241Z",
  "completed_at": "2026-06-10T09:00:03.241Z",
  "metadata": {
    "job_source": "adzuna",
    "priority": "normal"
  }
}
```

---

## Table: `relay-executions`

Stores one record per processing attempt for each event. Supports full retry history.

### Schema

| Attribute | Type | Description |
|---|---|---|
| `event_id` | String (PK) | Parent event identifier |
| `attempt` | Number (SK) | Attempt number (1, 2, 3…) |
| `execution_id` | String | Unique execution identifier: `exec_{uuid}` |
| `project_id` | String | Denormalized for query convenience |
| `event_type` | String | Denormalized for query convenience |
| `status` | String | `RUNNING` \| `COMPLETED` \| `FAILED` \| `TIMED_OUT` \| `SKIPPED` |
| `worker_function` | String | Lambda function name that processed this |
| `started_at` | String | ISO 8601 timestamp |
| `completed_at` | String | ISO 8601 timestamp (nullable) |
| `duration_ms` | Number | Execution duration in milliseconds |
| `error_type` | String | Error classification (nullable): `TIMEOUT` \| `RATE_LIMIT` \| `VALIDATION_ERROR` \| `UNKNOWN` |
| `error_message` | String | Human-readable error (nullable) |
| `error_stack` | String | Stack trace truncated to 2KB (nullable) |
| `output_ref` | String | `inline:{json}` or `s3:{bucket}/{key}` for execution output |
| `log_stream` | String | CloudWatch log stream name for full execution log |
| `retry_delay_ms` | Number | Delay before this attempt (0 for first attempt) |

### Global Secondary Indexes

**GSI-1: `project-status-index`**
- Partition key: `project_id`
- Sort key: `started_at`
- Used for: Per-project execution history

**GSI-2: `status-started-index`**
- Partition key: `status`
- Sort key: `started_at`
- Used for: Dashboard — "all failed executions today"

**GSI-3: `execution-id-index`**
- Partition key: `execution_id`
- Sort key: — (none)
- Used for: Direct execution lookup by ID (from logs, alerts)

### Example Item
```json
{
  "event_id": "evt_a1b2c3d4e5f6",
  "attempt": 1,
  "execution_id": "exec_f6e5d4c3b2a1",
  "project_id": "proj_careerOS",
  "event_type": "career.job.scoring.requested",
  "status": "COMPLETED",
  "worker_function": "relay-worker",
  "started_at": "2026-06-10T09:00:01.100Z",
  "completed_at": "2026-06-10T09:00:03.241Z",
  "duration_ms": 2141,
  "error_type": null,
  "error_message": null,
  "error_stack": null,
  "output_ref": "inline:{\"score\":0.87,\"fit_level\":\"strong\"}",
  "log_stream": "2026/06/10/[$LATEST]relay-worker-abc123",
  "retry_delay_ms": 0
}
```

---

## Table: `relay-workflows`

Defines the processing configuration for each event type per project.

### Schema

| Attribute | Type | Description |
|---|---|---|
| `project_id` | String (PK) | Project this config applies to |
| `event_type` | String (SK) | Event type this config applies to |
| `workflow_id` | String | Unique workflow identifier: `wf_{uuid}` |
| `handler_function` | String | Lambda function that handles this event type |
| `description` | String | Human-readable description |
| `is_active` | Boolean | Whether this workflow is active |
| `timeout_seconds` | Number | Max execution time before TIMED_OUT |
| `max_attempts` | Number | Max retry attempts (default: 3) |
| `base_delay_ms` | Number | Base retry delay in ms (default: 2000) |
| `backoff_multiplier` | Number | Retry delay multiplier (default: 2.0) |
| `max_delay_ms` | Number | Max retry delay cap in ms (default: 30000) |
| `retry_on` | List | Error types that trigger retry |
| `no_retry_on` | List | Error types that skip to DLQ immediately |
| `tags` | Map | Arbitrary labels for grouping/filtering |
| `created_at` | String | ISO 8601 timestamp |
| `updated_at` | String | ISO 8601 timestamp |

### Example Item
```json
{
  "project_id": "proj_careerOS",
  "event_type": "career.job.scoring.requested",
  "workflow_id": "wf_scoring_001",
  "handler_function": "relay-worker",
  "description": "Score job posting against candidate resume using Claude API",
  "is_active": true,
  "timeout_seconds": 30,
  "max_attempts": 3,
  "base_delay_ms": 2000,
  "backoff_multiplier": 2.0,
  "max_delay_ms": 30000,
  "retry_on": ["TIMEOUT", "RATE_LIMIT", "TRANSIENT_ERROR"],
  "no_retry_on": ["VALIDATION_ERROR", "SCHEMA_ERROR"],
  "tags": { "team": "careerOS", "criticality": "high" },
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z"
}
```

---

## Table: `relay-projects`

Application/project registry. One record per integrated application.

### Schema

| Attribute | Type | Description |
|---|---|---|
| `project_id` | String (PK) | Unique project identifier: `proj_{slug}` |
| `name` | String | Display name: "CareerOS" |
| `description` | String | Short description |
| `api_key_hash` | String | bcrypt hash of active API key |
| `api_key_prefix` | String | First 8 chars of key (for identification): `rlk_live_` |
| `is_active` | Boolean | Whether this project can submit events |
| `webhook_secret_arn` | String | SSM Parameter Store ARN for webhook secret |
| `contact_email` | String | Alert email for this project |
| `event_types_allowed` | List | Allowlist of event types this project can publish |
| `rate_limit_per_minute` | Number | Ingest rate limit (default: 100) |
| `created_at` | String | ISO 8601 timestamp |
| `updated_at` | String | ISO 8601 timestamp |

### Example Item
```json
{
  "project_id": "proj_careerOS",
  "name": "CareerOS",
  "description": "AI-powered job search automation platform",
  "api_key_hash": "$2b$12$...",
  "api_key_prefix": "rlk_live_",
  "is_active": true,
  "webhook_secret_arn": "arn:aws:ssm:us-east-1:...:parameter/relay/careerOS/webhook-secret",
  "contact_email": "alerts@careerOS.example",
  "event_types_allowed": [
    "career.job.ingested",
    "career.job.scoring.requested",
    "career.document.generation.requested",
    "career.digest.dispatch.scheduled"
  ],
  "rate_limit_per_minute": 100,
  "created_at": "2026-05-01T00:00:00.000Z",
  "updated_at": "2026-05-01T00:00:00.000Z"
}
```

---

## Table: `relay-audit`

Immutable append-only audit log. Every event state change, project configuration change, and manual admin action is recorded here.

### Schema

| Attribute | Type | Description |
|---|---|---|
| `project_id` | String (PK) | Project this audit record belongs to |
| `sort_key` | String (SK) | `{timestamp}#{record_id}` — lexicographic sort |
| `audit_id` | String | Unique audit record identifier: `aud_{uuid}` |
| `action` | String | What happened: `EVENT_RECEIVED`, `EXECUTION_STARTED`, `EXECUTION_COMPLETED`, `EXECUTION_FAILED`, `DEAD_LETTERED`, `CONFIG_CHANGED`, `PROJECT_CREATED` |
| `actor` | String | Who/what caused the action: `system`, `api_key_id`, `dashboard_user` |
| `resource_type` | String | `event` \| `execution` \| `workflow` \| `project` |
| `resource_id` | String | ID of the affected resource |
| `details` | Map | Action-specific context (non-sensitive) |
| `ip_address` | String | Request IP (nullable for internal actions) |
| `timestamp` | String | ISO 8601 timestamp |

### Example Item
```json
{
  "project_id": "proj_careerOS",
  "sort_key": "2026-06-10T09:00:03.241Z#aud_xyz123",
  "audit_id": "aud_xyz123",
  "action": "EXECUTION_COMPLETED",
  "actor": "system",
  "resource_type": "execution",
  "resource_id": "exec_f6e5d4c3b2a1",
  "details": {
    "event_id": "evt_a1b2c3d4e5f6",
    "event_type": "career.job.scoring.requested",
    "duration_ms": 2141,
    "attempt": 1
  },
  "ip_address": null,
  "timestamp": "2026-06-10T09:00:03.241Z"
}
```

---

## Indexing Strategy Summary

| Table | PK | SK | GSIs |
|---|---|---|---|
| `relay-events` | `event_id` | — | project+created, status+updated, type+created |
| `relay-executions` | `event_id` | `attempt` | project+started, status+started, execution_id |
| `relay-workflows` | `project_id` | `event_type` | — |
| `relay-projects` | `project_id` | — | — |
| `relay-audit` | `project_id` | `timestamp#record_id` | — |

---

## Data Retention Policy

| Data | Retention | Mechanism |
|---|---|---|
| Event records | 90 days | DynamoDB TTL on `created_at + 90d` |
| Execution records | 90 days | DynamoDB TTL on `started_at + 90d` |
| Audit records | 1 year | DynamoDB TTL on `timestamp + 365d` |
| S3 payloads | 30 days | S3 lifecycle rule |
| S3 artifacts | 90 days | S3 lifecycle rule |
| S3 DLQ snapshots | 14 days | S3 lifecycle rule |
| CloudWatch logs | 30 days | Log group retention setting |

DynamoDB TTL deletion is not immediate — items are deleted within 48 hours of expiry. This is acceptable for all Relay use cases.

---

## Migration Strategy

No formal migration tooling at Phase 1. DynamoDB schema is schemaless — adding new attributes to items does not require migrations. Tables are created once via SAM and rarely modified.

When table structural changes are required (new GSI, changed key schema):
1. Create new table with updated configuration
2. Backfill via a one-time Lambda script
3. Update all read/write code to target new table
4. Delete old table after validation window

This is sufficient for a portfolio project and reflects real-world DynamoDB migration practice.
