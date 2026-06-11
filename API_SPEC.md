# API_SPEC.md — Relay

## Overview

Relay exposes two API surfaces:

1. **Ingest API** — Used by applications (CareerOS, MarketMind, TimeKeep) to publish events and query their own event/execution history
2. **Dashboard API** — Used by the Relay dashboard frontend (Next.js on Vercel) to power the observability UI

Both are REST APIs served through AWS API Gateway → Lambda.

---

## Base URL

```
https://{api-gateway-id}.execute-api.us-east-1.amazonaws.com/prod
```

Custom domain (optional): `https://api.relay.yourdomain.com`

---

## Authentication

### API Key Authentication (Ingest API)
All Ingest API endpoints require an API key in the request header:

```
x-relay-api-key: rlk_live_abc123def456
```

Keys are validated by the Ingest Lambda against the `relay-projects` DynamoDB table (bcrypt comparison). Invalid or missing keys return `401 Unauthorized`.

**API key format:** `rlk_{environment}_{32-char-hex}`
- `rlk_live_` — production keys
- `rlk_test_` — development/test keys

### Dashboard JWT Authentication
The Dashboard API uses JWTs issued by the Relay auth flow (or Supabase Auth if added later). Token passed as `Authorization: Bearer {token}`.

For Phase 1, the dashboard API uses the same API key mechanism as the Ingest API to minimize auth complexity. JWT-based auth is a Phase 3 enhancement.

---

## Standard Response Envelope

All successful responses use a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-10T09:00:00.000Z"
  }
}
```

All error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "event_type is required",
    "field": "event_type"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-10T09:00:00.000Z"
  }
}
```

---

## Ingest API

### POST /events
Publish an event to Relay for async processing.

**Authentication:** API key required

**Request:**
```json
{
  "event_type": "career.job.scoring.requested",
  "idempotency_key": "career-job-xyz-scoring-v1",
  "payload": {
    "job_id": "job_abc123",
    "resume_id": "res_xyz456",
    "job_title": "Senior Software Engineer",
    "company": "Stripe"
  },
  "metadata": {
    "priority": "normal",
    "source": "adzuna"
  }
}
```

**Request fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `event_type` | string | Yes | Dot-notation event name |
| `payload` | object | Yes | Event-specific data (max 200KB inline, larger goes to S3) |
| `idempotency_key` | string | No | Client-supplied dedup key. If provided and event already exists with this key + project, returns existing event without reprocessing |
| `metadata` | object | No | Arbitrary key-value metadata, stored but not processed |

**Response: 202 Accepted**
```json
{
  "success": true,
  "data": {
    "event_id": "evt_a1b2c3d4e5f6",
    "status": "QUEUED",
    "event_type": "career.job.scoring.requested",
    "queued_at": "2026-06-10T09:00:00.123Z"
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2026-06-10T09:00:00.123Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing required fields, invalid event_type format |
| 400 | `PAYLOAD_TOO_LARGE` | Payload exceeds 10MB hard limit |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `EVENT_TYPE_NOT_ALLOWED` | event_type not in project's allowlist |
| 409 | `DUPLICATE_EVENT` | idempotency_key already exists (returns original event) |
| 429 | `RATE_LIMIT_EXCEEDED` | Project has exceeded rate limit |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### POST /events/batch
Publish multiple events in a single request.

**Authentication:** API key required

**Request:**
```json
{
  "events": [
    {
      "event_type": "career.job.scoring.requested",
      "idempotency_key": "batch-scoring-job-001",
      "payload": { "job_id": "job_001" }
    },
    {
      "event_type": "career.job.scoring.requested",
      "idempotency_key": "batch-scoring-job-002",
      "payload": { "job_id": "job_002" }
    }
  ]
}
```

**Constraints:**
- Maximum 25 events per batch
- Each event follows the same rules as single event POST
- Batch is not atomic — some events may succeed while others fail

**Response: 207 Multi-Status**
```json
{
  "success": true,
  "data": {
    "results": [
      { "index": 0, "event_id": "evt_001", "status": "QUEUED", "success": true },
      { "index": 1, "event_id": null, "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
    ],
    "summary": { "total": 2, "succeeded": 1, "failed": 1 }
  }
}
```

---

### GET /events/{event_id}
Retrieve the current status and details of a specific event.

**Authentication:** API key required (project can only access its own events)

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "event_id": "evt_a1b2c3d4e5f6",
    "project_id": "proj_careerOS",
    "event_type": "career.job.scoring.requested",
    "status": "COMPLETED",
    "attempt_count": 1,
    "created_at": "2026-06-10T09:00:00.000Z",
    "completed_at": "2026-06-10T09:00:03.241Z",
    "executions": [
      {
        "execution_id": "exec_xyz789",
        "attempt": 1,
        "status": "COMPLETED",
        "started_at": "2026-06-10T09:00:01.100Z",
        "completed_at": "2026-06-10T09:00:03.241Z",
        "duration_ms": 2141
      }
    ]
  }
}
```

---

### GET /events
List events for the authenticated project with filtering.

**Authentication:** API key required

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Filter by status |
| `event_type` | string | — | Filter by event type |
| `since` | ISO 8601 | 24h ago | Start of time range |
| `until` | ISO 8601 | now | End of time range |
| `limit` | number | 50 | Max results (max: 200) |
| `cursor` | string | — | Pagination cursor from previous response |

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "events": [ ... ],
    "cursor": "eyJldmVudF9pZCI6ImV2...",
    "has_more": true,
    "total_in_range": 142
  }
}
```

---

## Dashboard API

### GET /dashboard/overview
Returns summary metrics for the dashboard home screen.

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "total_events": 847,
    "completed": 831,
    "failed": 9,
    "dead_lettered": 3,
    "processing": 4,
    "success_rate": 0.981,
    "avg_execution_ms": 1840,
    "events_by_project": [
      { "project_id": "proj_careerOS", "project_name": "CareerOS", "count": 412 },
      { "project_id": "proj_marketMind", "project_name": "MarketMind", "count": 310 },
      { "project_id": "proj_timeKeep", "project_name": "TimeKeep", "count": 125 }
    ],
    "events_by_type": [
      { "event_type": "career.job.scoring.requested", "count": 387 }
    ]
  }
}
```

---

### GET /dashboard/events
Paginated event list with rich filtering for the dashboard.

**Query parameters:** Same as `GET /events` plus:
- `project_id` — filter by specific project (dashboard can see all)

---

### GET /dashboard/executions/{execution_id}
Detailed execution view including all attempts and log stream reference.

---

### GET /dashboard/projects
List all registered projects with their status and metrics.

---

### GET /dashboard/dlq
List all dead-lettered events with failure details.

---

### POST /dashboard/dlq/{event_id}/requeue
Manually re-queue a dead-lettered event for reprocessing.

**Request body:** Optional `{ "reset_attempt_count": true }` to restart retry counter.

**Response: 202 Accepted** with new queued event details.

---

## Webhook Handling

### Incoming Webhooks
Relay can receive webhooks from external services (e.g., Stripe, GitHub) and convert them to internal events.

**Endpoint:** `POST /webhooks/{project_id}/{source}`

**Verification:** HMAC-SHA256 signature validated against per-project, per-source secret stored in SSM.

**Example:** `POST /webhooks/proj_careerOS/github` receives a GitHub push event, converts it to `career.code.pushed` internal event, and queues it.

### Outbound Webhook Delivery
Relay can deliver events to external endpoints registered per workflow configuration. Delivery is handled by the Worker Lambda with retry logic identical to standard workflow processing.

Webhook delivery logs are stored as execution records with `event_type: relay.webhook.delivery.*`.

---

## Internal Event Publishing Patterns

Applications integrate with Relay through the published SDK (simple HTTP wrapper) rather than calling the API directly. The SDK handles:
- API key injection from environment variables
- Automatic retry on `429` (rate limit)
- Idempotency key generation if not provided
- Structured error handling

**Conceptual SDK usage (TypeScript):**
```typescript
import { RelayClient } from '@relay/client';

const relay = new RelayClient({
  apiKey: process.env.RELAY_API_KEY,
  projectId: 'proj_careerOS'
});

// Publish a single event
const event = await relay.publish({
  eventType: 'career.job.scoring.requested',
  payload: { jobId: 'job_abc123', resumeId: 'res_xyz' },
  idempotencyKey: `scoring-${jobId}-v1`
});

// Publish multiple events
const results = await relay.publishBatch([
  { eventType: 'career.job.scoring.requested', payload: { jobId: 'job_001' } },
  { eventType: 'career.job.scoring.requested', payload: { jobId: 'job_002' } }
]);
```

The SDK is a lightweight npm package maintained in the Relay monorepo under `packages/relay-client`.

---

## API Versioning

Phase 1 deploys at `/prod` with no version prefix. All endpoints are implicitly `v1`.

When breaking changes are required:
- New API Gateway stage `v2` is deployed
- Old stage remains active for backward compatibility
- Consumer applications migrate explicitly
- Deprecation window: 30 days minimum

This is the same pattern used by Stripe, GitHub, and Vercel APIs.

---

## Rate Limiting

Rate limiting is enforced at two levels:

**1. API Gateway Stage-Level:**
- Default: 1000 req/sec burst, 500 req/sec steady
- Applies to all requests regardless of project

**2. Application-Level (per project):**
- Ingest Lambda checks `rate_limit_per_minute` from the project's DynamoDB record
- Implemented as a DynamoDB counter with TTL (1 minute window)
- Exceeding limit returns `429 Too Many Requests`

At portfolio scale, hitting rate limits is not a realistic concern. The mechanism is implemented for correctness and as a demonstration of production thinking.

---

## Error Code Reference

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request schema invalid |
| `PAYLOAD_TOO_LARGE` | 400 | Payload exceeds 10MB limit |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Valid key but insufficient permissions |
| `EVENT_TYPE_NOT_ALLOWED` | 403 | Event type not in project allowlist |
| `NOT_FOUND` | 404 | Resource does not exist |
| `DUPLICATE_EVENT` | 409 | Idempotency key collision (not an error — returns original) |
| `RATE_LIMIT_EXCEEDED` | 429 | Project rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Downstream dependency unavailable |
