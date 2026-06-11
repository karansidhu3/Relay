# PRODUCT_OVERVIEW.md — Relay

## What Is Relay?

Relay is an internal infrastructure platform built to handle the parts of software that happen after the user clicks a button.

It is the async layer. The retry layer. The observability layer.

When CareerOS scores a job posting, MarketMind ingests a data batch, or TimeKeep processes a clock-out event — Relay is the platform that receives those events, queues the work, executes it reliably, retries failures, logs every step, and surfaces operational visibility into what happened and why.

Relay is not a user-facing product. It is infrastructure. It exists to make every other system in the ecosystem more reliable, observable, and operationally mature.

---

## Why Relay Exists

Modern software systems inevitably accumulate async work: background processing, scheduled tasks, external API calls, webhook deliveries, notification dispatch, data pipeline steps. Without a dedicated infrastructure layer, this work gets scattered — hardcoded retries here, ad-hoc queues there, missing error visibility everywhere.

Relay centralizes that concern. Instead of each application reinventing retry logic, dead-letter handling, execution logging, and failure alerting, they emit events into Relay and trust the platform to handle the rest.

This is not theoretical. In production systems at companies like Stripe, Linear, Vercel, and GitHub, this layer is called a job queue, workflow engine, or task platform. Relay is a solo-engineer-scale version of that same architectural pattern — built for real, deployed for real, solving a real coordination problem across real projects.

---

## Target Use Cases

### Event Queueing
Applications publish events to Relay. Relay queues them, ensures they are processed exactly once, and retries on failure.

**Example:** CareerOS publishes `job.scoring.requested` when a new job is ingested. Relay queues the scoring workflow, invokes the Claude API, and marks the job scored — retrying up to 3 times on timeout.

### Background Job Processing
Long-running work that should not block request/response cycles gets handed off to Relay.

**Example:** MarketMind publishes `corpus.ingestion.started` after uploading raw documents. Relay executes the chunking, embedding, and indexing pipeline asynchronously.

### Retry and Dead-Letter Handling
Relay handles transient failures automatically using configurable exponential backoff. Permanently failed executions are routed to a dead-letter queue and surfaced in the dashboard.

### Webhook Delivery
Applications can register webhooks and Relay will deliver events to external endpoints with retry logic, response logging, and delivery confirmation.

**Example:** TimeKeep sends clock-out events to an external payroll integration endpoint. Relay manages delivery, logs response codes, and alerts on persistent failure.

### Scheduled Workflows
Relay supports cron-triggered workflows — time-based executions that run on a schedule without application intervention.

**Example:** CareerOS triggers a daily `jobs.digest.compile` workflow each morning to aggregate and score new postings overnight.

### Observability and Operational Monitoring
Every event, execution, retry, and failure is logged with full payload context. The Relay dashboard provides real-time visibility into system health, workflow throughput, failure rates, and execution timelines.

---

## Ecosystem Relationship

Relay serves as the infrastructure backbone for three applications:

### CareerOS
CareerOS automates job search workflows — ingesting postings, scoring fit, generating tailored resumes and cover letters, and dispatching daily digests. Nearly every step is async. Relay handles scoring jobs, generating documents, and sending digest emails as queued, retriable workflows.

**Events CareerOS emits to Relay:**
- `career.job.ingested`
- `career.job.scoring.requested`
- `career.document.generation.requested`
- `career.digest.dispatch.scheduled`

### MarketMind
MarketMind is a financial intelligence platform that ingests market data, processes corpora, generates signals, and serves research queries. Data ingestion and corpus processing pipelines are expensive, long-running operations that cannot fail silently.

**Events MarketMind emits to Relay:**
- `marketmind.corpus.ingestion.started`
- `marketmind.embedding.pipeline.requested`
- `marketmind.signal.generation.requested`
- `marketmind.report.export.requested`

### TimeKeep
TimeKeep is a workforce scheduling and time-tracking application. Clock events, schedule changes, and payroll exports represent critical data flows that require guaranteed delivery and audit history.

**Events TimeKeep emits to Relay:**
- `timekeep.clockevent.recorded`
- `timekeep.schedule.updated`
- `timekeep.payroll.export.requested`
- `timekeep.notification.dispatch.requested`

---

## Key Engineering Goals

1. **Reliable async execution** — Events are never silently dropped. Processing failures are caught, logged, and retried automatically.

2. **Full observability** — Every event and execution is traceable from submission through completion. The dashboard surfaces operational health without needing to grep CloudWatch manually.

3. **Idempotent processing** — Processing the same event twice produces the same result. The system handles duplicates gracefully.

4. **Minimal operational overhead** — Relay is serverless-first. There are no servers to babysit, no clusters to maintain. It scales on demand and costs near-zero at low volume.

5. **Coherent event model** — Events follow a consistent naming convention and payload structure. Applications integrate with Relay through a clean, versioned API.

6. **Production-believable architecture** — The system reflects real engineering decisions made at real companies. Every component exists for a reason. Nothing is added for resume padding.

---

## System Philosophy

> Infrastructure should be invisible when it works and illuminating when it doesn't.

Relay is built on three principles:

**Simplicity over sophistication.** A well-designed SQS queue beats a misunderstood Kafka cluster every time. Complexity is earned, not assumed.

**Observability is not optional.** If you can't see what the system is doing, you don't understand the system. Logging, tracing, and metrics are first-class concerns from day one.

**Cost-awareness is a design constraint.** Real engineers think about the bill. Serverless-first, free-tier-maximizing, always-on-compute-avoiding design is not a compromise — it is discipline.

Relay is built by a solo engineer for a real portfolio. It solves real coordination problems. It is meant to be understood fully, deployed actually, and used genuinely — not described speculatively.
