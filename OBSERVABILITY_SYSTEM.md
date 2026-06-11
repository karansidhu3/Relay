# OBSERVABILITY_SYSTEM.md — Relay

## Philosophy

> You cannot operate what you cannot see.

Observability in Relay is not a feature added after the fact — it is a first-class design constraint. Every event, execution, retry, and failure produces structured data that can be queried, visualized, and acted on.

Relay's observability stack is intentionally built on free or near-free infrastructure: CloudWatch Logs, CloudWatch Metrics, and DynamoDB queries. No third-party APM tool is required at portfolio scale. This demonstrates understanding of native cloud observability without tool dependency.

---

## Three Pillars

### 1. Logs
Structured JSON logs from every Lambda function, written to CloudWatch Log Groups. Logs answer: **what happened?**

### 2. Metrics
Custom CloudWatch metrics derived from Lambda executions. Metrics answer: **how much happened, how fast, how often?**

### 3. Traces
Execution timeline reconstruction from DynamoDB records. Traces answer: **what happened to this specific event, and why?**

---

## Logging Structure

Every Lambda function uses a structured logger that emits JSON to stdout (captured by CloudWatch automatically).

### Log Entry Schema

```typescript
interface RelayLogEntry {
  // Required fields
  timestamp: string;          // ISO 8601
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  function: string;           // Lambda function name
  request_id: string;         // Lambda request ID (from context)
  message: string;            // Human-readable description

  // Context fields (present when available)
  event_id?: string;
  execution_id?: string;
  project_id?: string;
  event_type?: string;
  attempt?: number;

  // Execution fields (on completion/failure)
  duration_ms?: number;
  status?: string;

  // Error fields (on error)
  error_type?: string;
  error_message?: string;
  error_stack?: string;       // Truncated to 2KB

  // Custom payload (any additional context)
  data?: Record<string, unknown>;
}
```

### Log Level Standards

| Level | When to Use |
|---|---|
| `DEBUG` | Detailed execution steps. Disabled in production by default. |
| `INFO` | Normal operation milestones: event received, execution started, execution completed |
| `WARN` | Unexpected but handled conditions: retry triggered, rate limit hit, payload truncated |
| `ERROR` | Failed operations: execution failed, DLQ entry, Lambda crash context |

### Example Log Sequence (single event lifecycle)

```json
// relay-ingest
{"level":"INFO","function":"relay-ingest","message":"Event received","event_type":"career.job.scoring.requested","project_id":"proj_careerOS","payload_size_bytes":512,"timestamp":"2026-06-10T09:00:00.100Z"}
{"level":"INFO","function":"relay-ingest","message":"Event queued","event_id":"evt_abc123","queue_message_id":"msg_xyz","timestamp":"2026-06-10T09:00:00.241Z"}

// relay-worker
{"level":"INFO","function":"relay-worker","message":"Execution started","event_id":"evt_abc123","event_type":"career.job.scoring.requested","attempt":1,"execution_id":"exec_789","timestamp":"2026-06-10T09:00:01.100Z"}
{"level":"INFO","function":"relay-worker","message":"Calling Claude API for job scoring","event_id":"evt_abc123","model":"claude-sonnet","timestamp":"2026-06-10T09:00:01.200Z"}
{"level":"INFO","function":"relay-worker","message":"Execution completed","event_id":"evt_abc123","execution_id":"exec_789","duration_ms":2141,"status":"COMPLETED","timestamp":"2026-06-10T09:00:03.241Z"}
```

---

## Metrics

### Custom CloudWatch Metrics (emitted from Lambda via PutMetricData)

All metrics are in the `Relay` namespace.

| Metric | Unit | Dimensions | Description |
|---|---|---|---|
| `EventsReceived` | Count | ProjectId, EventType | Events ingested per ingest call |
| `ExecutionsCompleted` | Count | ProjectId, EventType | Successful executions |
| `ExecutionsFailed` | Count | ProjectId, EventType, ErrorType | Failed executions |
| `DeadLetteredExecutions` | Count | ProjectId, EventType | DLQ entries |
| `ExecutionDuration` | Milliseconds | ProjectId, EventType | End-to-end execution time |
| `RetryTriggered` | Count | ProjectId, EventType, Attempt | Retries initiated |
| `PayloadSizeBytes` | Bytes | ProjectId | Incoming payload sizes |

### CloudWatch Alarms

| Alarm | Threshold | Action |
|---|---|---|
| `DLQEntries` | > 0 in 5 min | Email alert |
| `ExecutionFailureRate` | > 10% in 5 min | Email alert |
| `LambdaErrors-Ingest` | > 5 in 5 min | Email alert |
| `LambdaErrors-Worker` | > 5 in 5 min | Email alert |
| `BillingEstimate` | > $1 | Email alert |

### Derived Metrics (computed by Dashboard API)

The Dashboard Lambda computes these from DynamoDB queries rather than from raw CloudWatch metrics:

- **Success rate** = `COMPLETED / (COMPLETED + FAILED + DEAD_LETTERED)`
- **Average execution time** by event type
- **P95 execution time** by event type
- **Retry rate** = events with attempt_count > 1 / total events
- **DLQ rate** = `DEAD_LETTERED / total events`
- **Throughput** = events per hour over sliding window

---

## Execution Timeline

The execution timeline is the most important observability primitive in Relay. It provides a complete chronological view of everything that happened to a single event.

### Timeline Data Model

For event `evt_abc123`, the timeline reconstructs:

```
[09:00:00.100] EVENT RECEIVED        — Ingest Lambda accepted event
[09:00:00.241] EVENT QUEUED          — SQS message published
[09:00:01.100] EXECUTION STARTED     — Worker Lambda claimed message (Attempt 1)
[09:00:01.200]   → Claude API called
[09:00:03.200]   → Claude API responded (score: 0.87)
[09:00:03.241] EXECUTION COMPLETED   — Duration: 2141ms
```

For a failed event with retries:

```
[09:00:00.100] EVENT RECEIVED
[09:00:00.241] EVENT QUEUED
[09:00:01.100] EXECUTION STARTED     (Attempt 1)
[09:00:31.100] EXECUTION FAILED      — TIMEOUT after 30s
[09:00:31.200] RETRY SCHEDULED       — Delay: 2000ms
[09:00:33.200] EXECUTION STARTED     (Attempt 2)
[09:00:33.800] EXECUTION FAILED      — RATE_LIMIT (429 from Claude API)
[09:00:33.900] RETRY SCHEDULED       — Delay: 4000ms
[09:00:37.900] EXECUTION STARTED     (Attempt 3)
[09:00:38.400] EXECUTION FAILED      — RATE_LIMIT
[09:00:38.500] DEAD LETTERED         — Max attempts (3) exhausted
```

### Timeline Construction

The Dashboard API constructs execution timelines by:
1. Fetching the event record from `relay-events`
2. Fetching all execution attempts from `relay-executions` (sort by `attempt` ascending)
3. Optionally fetching log entries from CloudWatch Logs Insights for detailed sub-steps
4. Assembling the timeline array sorted by timestamp

---

## Traceability

Every log entry, DynamoDB record, and CloudWatch metric shares the same `event_id`. This makes a single event fully traceable across:

- DynamoDB `relay-events` record (canonical state)
- DynamoDB `relay-executions` records (attempt history)
- CloudWatch Logs `/relay/ingest` (ingestion log)
- CloudWatch Logs `/relay/worker` (processing log)
- S3 `relay-payloads/{event_id}/payload.json` (if large payload)
- S3 `relay-snapshots/{event_id}/snapshot.json` (if DLQ'd)

Searching CloudWatch Logs Insights for `event_id = "evt_abc123"` returns every log line that touched that event across all Lambda functions.

---

## Dashboard Monitoring Modules

### Module 1: System Overview
- Total events in last 24h / 7d / 30d (selectable)
- Overall success rate gauge
- Active executions count (currently PROCESSING)
- DLQ count with alert badge if > 0
- Events per hour sparkline (last 24h)
- Failure rate sparkline (last 24h)

### Module 2: Event Stream (Live Feed)
- Real-time scrolling list of recent events
- Each row: timestamp, project badge, event type, status pill, duration
- Clickable rows open execution detail drawer
- Filter by project, event type, status
- Auto-refresh every 30 seconds (polling)

### Module 3: Project Breakdown
- Per-project event count, success rate, avg duration
- Sortable table view
- Click to drill into project-specific event stream

### Module 4: Execution Detail
Full execution timeline for a selected event:
- Visual timeline with timestamps
- Attempt history with status and duration
- Error details and stack trace (if failed)
- Raw payload viewer (formatted JSON)
- Link to CloudWatch log stream

### Module 5: Dead Letter Queue
- List of all DLQ'd events
- Filter by project, event type, date range
- Failure snapshot viewer
- **Re-queue button** — manually retry a DLQ'd event
- Bulk re-queue by filter

### Module 6: Performance Analytics
- Execution duration by event type (bar/violin chart)
- Throughput over time by project (line chart)
- Retry frequency heatmap by event type
- Error type distribution (pie chart)

### Module 7: System Health
- Lambda function error rates
- SQS queue depth (main + DLQ)
- Recent CloudWatch alarms
- Estimated monthly cost (derived from usage metrics)

---

## Operational Visibility Principles

**1. Dead-letter queue is always visible.** DLQ count is on the primary navigation, always in view. Zero tolerance for hiding failures.

**2. Every execution is clickable.** The event stream is never a flat log dump — every row leads to a full execution detail view.

**3. Performance trends are surfaced proactively.** The dashboard shows if event processing is getting slower over time, before it becomes a problem.

**4. Filtering is first-class.** Every view supports filtering by project, event type, time range, and status. Visibility is only valuable if it's navigable.

**5. Re-queue is always one click.** Dead-lettered events should be recoverable without touching AWS directly. The dashboard provides direct operational control.
