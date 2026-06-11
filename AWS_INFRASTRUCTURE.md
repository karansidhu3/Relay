# AWS_INFRASTRUCTURE.md — Relay

## Services Overview

Relay uses five core AWS services and two optional services. Every service is justified. Nothing is included speculatively.

---

## Service-by-Service Breakdown

### API Gateway (REST API)
**Why it exists:** The public entry point for all Relay API traffic. Routes HTTP requests to Lambda functions. Handles TLS termination, basic request throttling, and CORS.

**Configuration:**
- REST API (not HTTP API — REST API has better integration options for portfolio demonstration)
- Deployed to a single stage: `prod`
- Custom domain: optional, Relay can run on the generated API Gateway URL
- Default throttling: 1000 requests/second burst, 500 requests/second steady state

**Free tier:** 1M REST API calls/month for the first 12 months. After 12 months, $3.50 per million calls — irrelevant at portfolio volume.

**IAM:** API Gateway invokes Lambda via resource-based policy (not IAM role). Lambda execution role is separate.

---

### Lambda
**Why it exists:** All processing logic runs in Lambda. No servers to manage, pay-per-invocation billing, native SQS trigger integration.

**Functions:**

| Function | Trigger | Timeout | Memory |
|---|---|---|---|
| `relay-ingest` | API Gateway | 10s | 256MB |
| `relay-worker` | SQS | 60s | 512MB |
| `relay-dlq-handler` | SQS (DLQ) | 30s | 256MB |
| `relay-scheduler` | EventBridge | 30s | 256MB |
| `relay-api-read` | API Gateway | 10s | 256MB |

**Runtime:** Node.js 20.x (TypeScript compiled to JS, deployed as zip or container)

**Deployment package:** Zip upload via AWS CLI or SAM. Package size target: < 10MB per function.

**Free tier:** 1M invocations + 400,000 GB-seconds compute/month. Never exceeded at portfolio scale.

**Cold start mitigation:** Not required for async workers. `relay-ingest` and `relay-api-read` are the only latency-sensitive functions. Both should be monitored but cold starts are acceptable for a portfolio platform.

**Environment variables:** Stored in Lambda environment config (not SSM Parameter Store at this scale). See environment variable strategy below.

---

### SQS (Simple Queue Service)
**Why it exists:** Durable, managed message queuing. The backbone of Relay's async processing model. Provides at-least-once delivery, configurable visibility timeouts, and native DLQ redrive.

**Queues:**

| Queue | Type | Visibility Timeout | Retention | Max Receive Count |
|---|---|---|---|---|
| `relay-main-queue` | Standard | 30s | 4 days | 3 |
| `relay-dlq` | Standard | 30s | 14 days | — |

**Why Standard, not FIFO:**
- Standard queues are free tier eligible (1M requests/month)
- FIFO queues are not covered by the same free tier
- Relay does not require strict ordering — events are independent
- Idempotency at the application level handles duplicate delivery

**Free tier:** 1M requests/month. Includes SendMessage, ReceiveMessage, DeleteMessage. Portfolio usage: < 50K requests/month.

**Security:** SQS resource policy restricts `SendMessage` to the Ingest Lambda's execution role. Worker Lambda and DLQ Handler Lambda have `ReceiveMessage` + `DeleteMessage` permissions via their execution roles.

---

### DynamoDB
**Why it exists:** Primary data store for events, executions, retry state, and workflow configuration. Serverless, key-value optimized, native Lambda integration, no connection pooling overhead.

**Tables:**

| Table | Primary Key | Sort Key | Purpose |
|---|---|---|---|
| `relay-events` | `event_id` (String) | — | Event records |
| `relay-executions` | `event_id` (String) | `attempt` (Number) | Execution log per attempt |
| `relay-workflows` | `project_id` (String) | `event_type` (String) | Workflow configuration |
| `relay-projects` | `project_id` (String) | — | Project/application metadata |
| `relay-audit` | `project_id` (String) | `timestamp#record_id` (String) | Audit history |

**Billing mode:** On-demand (PAY_PER_REQUEST). No capacity planning. Scales automatically.

**Free tier:** 25GB storage, 25 Write Capacity Units, 25 Read Capacity Units (provisioned) OR 200M requests/month (on-demand). At portfolio scale, both are effectively unlimited.

**GSIs (Global Secondary Indexes):**
- `relay-events`: GSI on `project_id + created_at` for dashboard queries by project
- `relay-executions`: GSI on `status + updated_at` for filtering by execution status
- `relay-executions`: GSI on `project_id + updated_at` for per-project execution history

**Important:** DynamoDB GSIs consume additional read/write capacity. At portfolio scale, this is negligible.

---

### S3
**Why it exists:** Object storage for large event payloads (> 256KB), execution artifacts, and DLQ failure snapshots. Effectively unlimited cheap storage with strong durability guarantees.

**Buckets:**

| Bucket | Purpose | Lifecycle Policy |
|---|---|---|
| `relay-payloads-{account-id}` | Event payload storage | Delete after 30 days |
| `relay-artifacts-{account-id}` | Execution outputs and reports | Delete after 90 days |
| `relay-snapshots-{account-id}` | DLQ failure snapshots | Delete after 14 days |

**Naming:** Account ID suffix prevents global name collisions. Bucket names must be globally unique.

**Access control:** All buckets are private. No public access. Lambda functions access via their execution role (IAM policy grants specific bucket access).

**Free tier:** 5GB standard storage, 20,000 GET requests, 2,000 PUT requests/month. Never exceeded at portfolio scale.

---

### CloudWatch
**Why it exists:** Centralized logging, metrics, alarms, and dashboards. Every Lambda function writes structured JSON logs to CloudWatch. No third-party logging service required — CloudWatch handles everything needed at this scale.

**Log Groups:**

| Log Group | Retention |
|---|---|
| `/relay/ingest` | 30 days |
| `/relay/worker` | 30 days |
| `/relay/dlq-handler` | 30 days |
| `/relay/scheduler` | 30 days |
| `/relay/api-read` | 30 days |

**Custom Metrics (emitted from Lambda):**
- `Relay/EventsReceived` — count of events ingested
- `Relay/ExecutionsCompleted` — count of successful executions
- `Relay/ExecutionsFailed` — count of failed executions
- `Relay/DeadLetteredExecutions` — count of DLQ deliveries
- `Relay/ExecutionDuration` — processing time per event type

**Alarms:**
- `DeadLetteredExecutions > 0` — alert on any DLQ entry
- `ExecutionsFailed > 10` in 5 minutes — alert on failure spike
- `Lambda Errors > 5` per function — alert on Lambda crashes

**Free tier:** 5GB log ingestion/month, 5GB log storage/month, 3 dashboards, 10 custom metrics. All within range.

---

### EventBridge (Optional — Phase 3)
**Why it exists:** Cron-triggered scheduled workflows. CareerOS's daily digest dispatch, MarketMind's scheduled ingestion, and TimeKeep's payroll export triggers are time-based. EventBridge rules invoke the Scheduler Lambda on a cron schedule.

**Free tier:** 14M custom events/month for the first year.

**Alternative considered:** CloudWatch Events (legacy, same underlying service). EventBridge is the current AWS recommendation.

**Not included in Phase 1.** Scheduled workflows are lower priority than core event processing.

---

## Deployment Strategy

### Infrastructure-as-Code: AWS SAM (Serverless Application Model)
Relay's AWS infrastructure is defined in a single `template.yaml` using AWS SAM. SAM extends CloudFormation with Lambda-specific abstractions.

**Why SAM over Terraform:**
- SAM is purpose-built for serverless (Lambda + API Gateway + SQS is its primary use case)
- Zero additional tooling cost
- Native AWS integration (CloudFormation under the hood)
- Simpler syntax for Lambda-centric projects
- `sam local invoke` enables local Lambda testing without deployment

**Why not CDK:**
CDK is excellent but adds TypeScript dependency complexity and higher learning curve. SAM is sufficient for this project's scope. CDK is a natural next skill to develop after Relay is complete.

**Deployment commands:**
```bash
sam build
sam deploy --guided  # first deploy, saves config to samconfig.toml
sam deploy           # subsequent deploys
```

**Environments:**
- `dev` — local development via `sam local`
- `prod` — single AWS account deployment

A staging environment is deliberately not included. At portfolio scale, the operational overhead is not worth it. Tests + careful prod deployment is the right tradeoff.

---

## IAM Principles

**Least privilege — enforced strictly.**

Each Lambda function has its own IAM execution role. No function shares a role. No function has `*` resource access.

**Example — Ingest Lambda execution role permissions:**
```yaml
Policies:
  - DynamoDB:PutItem on relay-events table
  - DynamoDB:GetItem on relay-events table (idempotency check)
  - SQS:SendMessage on relay-main-queue
  - S3:PutObject on relay-payloads bucket
  - CloudWatch:PutMetricData
  - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
```

**Example — Worker Lambda execution role permissions:**
```yaml
Policies:
  - DynamoDB:GetItem, PutItem, UpdateItem on relay-executions table
  - DynamoDB:GetItem on relay-events table
  - DynamoDB:GetItem on relay-workflows table
  - SQS:ReceiveMessage, DeleteMessage, GetQueueAttributes on relay-main-queue
  - S3:GetObject on relay-payloads bucket
  - S3:PutObject on relay-artifacts bucket
  - CloudWatch:PutMetricData
  - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
```

**No wildcard resource ARNs.** Every DynamoDB permission specifies the table ARN. Every S3 permission specifies the bucket ARN + path prefix.

---

## Environment Variable Strategy

Lambda environment variables store non-secret configuration. Secrets (API keys, external service credentials) use AWS Secrets Manager or SSM Parameter Store.

**Non-secret environment variables (Lambda env config):**
```
MAIN_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
DLQ_URL=https://sqs.us-east-1.amazonaws.com/...
EVENTS_TABLE=relay-events
EXECUTIONS_TABLE=relay-executions
WORKFLOWS_TABLE=relay-workflows
PROJECTS_TABLE=relay-projects
PAYLOAD_BUCKET=relay-payloads-{account-id}
ARTIFACTS_BUCKET=relay-artifacts-{account-id}
ENVIRONMENT=prod
LOG_LEVEL=info
```

**Secret variables (SSM Parameter Store):**
```
/relay/anthropic-api-key        ← if Relay invokes Claude directly
/relay/webhook-signing-secret   ← for webhook payload verification
```

Lambda functions retrieve secrets at cold start via AWS SDK (`GetParameter`). Secrets are cached in-process for the Lambda instance lifetime.

**SAM template references environment variables via `!Sub` and `!Ref` to avoid hardcoding.**

---

## Security Considerations

**1. API Authentication**
All Relay API endpoints require an `x-relay-api-key` header. The key is validated by the Ingest Lambda against a value in SSM Parameter Store. Per-project API keys are stored in the `relay-projects` DynamoDB table.

**2. Webhook Verification**
Incoming webhooks are verified using HMAC-SHA256 signature validation (same pattern as Stripe, GitHub, and Vercel webhooks). The shared secret is stored per-project in SSM.

**3. No Public DynamoDB or S3 Access**
All buckets have public access blocked at the account level. DynamoDB has no public endpoints — it is only accessible from Lambda via IAM.

**4. Lambda Function URLs (Not Used)**
API Gateway is used instead of Lambda Function URLs. API Gateway provides throttling, logging, and usage plan controls that Lambda URLs lack.

**5. TLS Everywhere**
API Gateway terminates TLS. All service-to-service communication (Lambda → DynamoDB, Lambda → SQS, Lambda → S3) is encrypted in transit by default.

**6. CORS**
API Gateway CORS configuration restricts allowed origins to the Relay dashboard domain (Vercel deployment URL). During development, `localhost:3000` is allowed.

---

## Logging and Monitoring Setup

**Structured JSON logging from Lambda:**
Every Lambda function uses a structured logger that outputs JSON. Log entries include:
```json
{
  "timestamp": "2026-06-10T12:00:00Z",
  "level": "INFO",
  "function": "relay-worker",
  "event_id": "evt_abc123",
  "execution_id": "exec_xyz789",
  "project_id": "proj_careerOS",
  "event_type": "career.job.scoring.requested",
  "message": "Execution completed successfully",
  "duration_ms": 1240,
  "attempt": 1
}
```

**CloudWatch Log Insights queries (saved for dashboard use):**
```sql
-- Failed executions in last hour
fields @timestamp, event_id, event_type, error_message
| filter level = "ERROR"
| sort @timestamp desc
| limit 50

-- Execution duration by event type
fields event_type, duration_ms
| filter message = "Execution completed"
| stats avg(duration_ms), max(duration_ms) by event_type
```

**Billing alarm:**
CloudWatch billing alarm set at $1 threshold. Alert sent to developer email. This catches any unexpected cost before it compounds.
