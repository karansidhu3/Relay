# IMPLEMENTATION_ROADMAP.md — Relay

## Overview

This roadmap is organized into 7 phases. Each phase has a clear goal, concrete tasks, defined deliverables, and a testing strategy. The plan is intentionally sequential — later phases depend on earlier ones being complete and verified.

**Total estimated implementation time:** 6–8 weeks of focused part-time work (2–4 hours/day).

**Critical path:** Phase 1 → 2 → 3 → 4 → 5. Phases 6 and 7 can begin in parallel with Phase 5.

---

## Phase 1: Project Scaffolding
**Goal:** Create the project structure, configure tooling, and establish development environment. Nothing runs in AWS yet.

**Estimated time:** 2–3 days

### Tasks
- [ ] Initialize monorepo structure (Turborepo or simple npm workspaces)
- [ ] Create `packages/relay-api/` — Lambda functions (TypeScript)
- [ ] Create `packages/relay-dashboard/` — Next.js frontend
- [ ] Create `packages/relay-client/` — SDK for consuming applications
- [ ] Configure TypeScript (strict mode, path aliases) across all packages
- [ ] Configure ESLint + Prettier (consistent rules across packages)
- [ ] Create `infrastructure/template.yaml` — AWS SAM template (empty, to be filled)
- [ ] Set up `.env.example` files for all packages
- [ ] Write root `README.md` with project overview and setup instructions
- [ ] Initialize git repo with `.gitignore` (exclude `node_modules`, `.env`, `dist`, `.aws-sam`)

### Dependencies
None. This is the foundation.

### Deliverables
- Monorepo with three packages, all compiling without errors
- TypeScript configs in place
- ESLint passing on empty codebases

### Testing Strategy
- `tsc --noEmit` passes in all packages
- `eslint` passes with no warnings

### Expected Complexity: Low

---

## Phase 2: AWS Infrastructure Setup
**Goal:** Deploy the AWS infrastructure skeleton. All services created, no application logic yet.

**Estimated time:** 3–4 days

### ⚠️ HUMAN ACTIONS REQUIRED BEFORE THIS PHASE

**Stop. The following must be completed manually before Phase 2 implementation can begin:**

1. **AWS Account** — Create an AWS account at https://aws.amazon.com if not already done. Free tier applies to new accounts.

2. **AWS CLI** — Install and configure:
   ```bash
   brew install awscli          # macOS
   aws configure                # Enter Access Key ID, Secret Key, region (us-east-1), output (json)
   ```

3. **AWS SAM CLI** — Install:
   ```bash
   brew install aws-sam-cli
   ```

4. **IAM User for deployment** — In AWS Console → IAM → Create user `relay-deploy` with:
   - Programmatic access only
   - Attach policies: `AmazonDynamoDBFullAccess`, `AmazonSQSFullAccess`, `AmazonS3FullAccess`, `AWSLambda_FullAccess`, `AmazonAPIGatewayAdministrator`, `CloudWatchFullAccess`, `IAMFullAccess`
   - Note the Access Key ID and Secret Access Key

5. **S3 Bucket for SAM deployments** — SAM needs an S3 bucket to upload Lambda artifacts:
   ```bash
   aws s3 mb s3://relay-sam-artifacts-{your-account-id} --region us-east-1
   ```

**Do not proceed with Phase 2 until all five actions above are complete.**

---

### Tasks (after human actions complete)

- [ ] Write `infrastructure/template.yaml`:
  - DynamoDB tables (relay-events, relay-executions, relay-workflows, relay-projects, relay-audit) with indexes
  - SQS queues (relay-main-queue with DLQ redrive, relay-dlq)
  - S3 buckets (payloads, artifacts, snapshots) with lifecycle policies
  - Lambda function stubs (5 functions, placeholder handlers)
  - API Gateway with routes pointing to Lambda stubs
  - IAM roles for each Lambda function (least privilege)
  - CloudWatch Log Groups with 30-day retention
  - CloudWatch billing alarm at $1

- [ ] Configure `samconfig.toml` for `sam deploy`:
  ```toml
  [default.deploy.parameters]
  stack_name = "relay-prod"
  s3_bucket = "relay-sam-artifacts-{account-id}"
  region = "us-east-1"
  capabilities = "CAPABILITY_IAM"
  ```

- [ ] Deploy infrastructure:
  ```bash
  sam build
  sam deploy
  ```

- [ ] Verify in AWS Console:
  - All DynamoDB tables created with correct indexes
  - SQS queues with DLQ redrive policy configured
  - S3 buckets created with correct lifecycle rules
  - Lambda functions created (all returning 200 with placeholder response)
  - API Gateway deployed to `prod` stage
  - CloudWatch Log Groups created

- [ ] Store environment variables in `.env.local` for local development:
  - All queue URLs, table names, bucket names exported from CloudFormation outputs

### Dependencies
- Phase 1 complete
- AWS account and CLI configured (human action)

### Deliverables
- SAM `template.yaml` defining all infrastructure
- All AWS resources created in `us-east-1`
- API Gateway base URL accessible (placeholder 200 responses)
- CloudFormation stack `relay-prod` visible in AWS Console

### Testing Strategy
- `curl {API_GATEWAY_URL}/events` returns placeholder JSON (Lambda stub)
- AWS Console confirms all resources are ACTIVE
- No unexpected charges (billing alarm is set)

### Expected Complexity: Medium (first SAM deployment has learning curve)

---

## Phase 3: Core API Implementation
**Goal:** Implement the Ingest Lambda and Worker Lambda. Events can be published, queued, and processed end-to-end.

**Estimated time:** 5–7 days

### Tasks

**Ingest Lambda (`relay-ingest`):**
- [ ] Implement request validation (event_type format, required fields, payload size)
- [ ] Implement API key validation against DynamoDB `relay-projects`
- [ ] Implement event_type allowlist check
- [ ] Implement idempotency check (idempotency_key lookup)
- [ ] Implement payload routing (inline vs S3 offload at 200KB threshold)
- [ ] Implement DynamoDB write (event record with RECEIVED status)
- [ ] Implement SQS publish (minimal SQS message with event_id reference)
- [ ] Implement status update to QUEUED after SQS publish
- [ ] Implement structured logging throughout
- [ ] Return 202 Accepted response with event_id

**Worker Lambda (`relay-worker`):**
- [ ] Implement SQS event source mapping (batch size: 1 for clarity)
- [ ] Implement event fetch from DynamoDB
- [ ] Implement payload fetch (inline or S3)
- [ ] Implement execution idempotency check
- [ ] Implement execution record creation (RUNNING status)
- [ ] Implement workflow router (event_type → handler function mapping)
- [ ] Implement `career.job.scoring.requested` stub handler (mock response for now)
- [ ] Implement error classification logic
- [ ] Implement SQS visibility timeout change for exponential backoff
- [ ] Implement execution record update (COMPLETED or FAILED)
- [ ] Implement structured logging throughout

**Dashboard Read Lambda (`relay-api-read`):**
- [ ] Implement `GET /events` with project + status + time range filtering
- [ ] Implement `GET /events/:id` with execution history join
- [ ] Implement `GET /dashboard/overview` aggregation query

### Dependencies
- Phase 2 complete (infrastructure deployed)
- DynamoDB tables accessible
- SQS queues accessible

### Deliverables
- End-to-end event lifecycle working: POST /events → SQS → Worker Lambda → DynamoDB update
- Execution status visible via GET /events/:id
- Local testing via `sam local invoke` and `sam local start-api`

### Testing Strategy
- Integration test: POST /events with valid payload → verify DynamoDB event record → verify SQS message → verify Worker execution → verify COMPLETED status
- Error test: POST /events with invalid API key → 401 response
- Idempotency test: POST same event twice with same idempotency_key → second returns 409 with original event
- Manual testing via curl or Postman against local SAM endpoint

### Expected Complexity: High (most logic lives here)

---

## Phase 4: Retry and DLQ Implementation
**Goal:** Retry logic and dead-letter queue handling work correctly. Failed events are traceable and recoverable.

**Estimated time:** 3–4 days

### Tasks

- [ ] Implement exponential backoff via `changeMessageVisibility` in Worker Lambda
- [ ] Test retry progression: configure `maxReceiveCount: 3` on main queue, verify DLQ routing after 3 failures
- [ ] Implement DLQ Handler Lambda:
  - Parse DLQ message
  - Fetch execution history from DynamoDB
  - Write failure snapshot to S3 (full payload + all attempt logs)
  - Update event status to `DEAD_LETTERED` in DynamoDB
  - Emit `relay.execution.dead_lettered` internal CloudWatch metric
- [ ] Implement `POST /dashboard/dlq/:event_id/requeue` endpoint:
  - Validate DLQ'd event exists
  - Reset attempt count if requested
  - Re-publish to main SQS queue
  - Update event status to `QUEUED`
- [ ] Implement CloudWatch alarm for DLQ entries (> 0 triggers email alert)
- [ ] Verify full lifecycle: event → fail 3 times → DLQ → requeue → COMPLETED

### Dependencies
- Phase 3 complete

### Deliverables
- Retry lifecycle working end-to-end
- DLQ entries visible in DynamoDB and S3 snapshots
- Re-queue API endpoint functional
- CloudWatch alarm triggers on DLQ entry

### Testing Strategy
- Forced failure test: configure a test event_type with a handler that always throws `TRANSIENT_ERROR` → verify 3 attempts → verify DLQ entry → verify snapshot in S3
- Requeue test: DLQ'd event → POST requeue → verify QUEUED status → verify execution proceeds
- Backoff timing test: verify attempt 1 delay ≈ 2s, attempt 2 delay ≈ 4s via CloudWatch log timestamps

### Expected Complexity: Medium

---

## Phase 5: Dashboard Frontend
**Goal:** Next.js dashboard is deployed on Vercel and provides full observability into the Relay system.

**Estimated time:** 7–10 days

### ⚠️ HUMAN ACTION REQUIRED

**Before Phase 5:**
- Select a visual direction from the three options in `FRONTEND_STRATEGY.md` (Terminal / Modern Observability / Control Room)
- Create a Vercel account at https://vercel.com (free tier is sufficient)
- Connect the GitHub repo to Vercel for automatic deployments

---

### Tasks

**Foundation:**
- [ ] Configure Tailwind with chosen color palette and typography
- [ ] Build primitive component library: Button, Card, Badge, StatusPill, Skeleton
- [ ] Build layout components: Sidebar, Topbar, PageContainer
- [ ] Configure API client in `lib/api/` with base URL from environment variable

**Pages:**
- [ ] `/` — System Overview page with metric cards and event sparklines
- [ ] `/events` — Event stream with filtering and pagination
- [ ] `/events/:id` — Execution detail with timeline visualization
- [ ] `/dlq` — DLQ management with re-queue capability
- [ ] `/projects` — Project list with per-project health cards
- [ ] `/analytics` — Basic charts (throughput, duration, error distribution)

**Charts:**
- [ ] Events per hour sparkline (Recharts LineChart)
- [ ] Execution duration by event type (Recharts BarChart)
- [ ] Error type distribution (Recharts PieChart)
- [ ] Throughput over time by project (Recharts AreaChart)

**Interactive features:**
- [ ] Filter bar (project, event_type, status, time range)
- [ ] Event stream auto-refresh (SWR polling, 30s interval)
- [ ] Execution detail drawer (Framer Motion slide-in)
- [ ] Re-queue confirmation modal
- [ ] Raw payload JSON viewer (with syntax highlighting via `react-json-view` or custom)

**Deployment:**
- [ ] Deploy to Vercel via GitHub integration
- [ ] Configure `RELAY_API_BASE_URL` environment variable in Vercel dashboard
- [ ] Configure CORS on API Gateway to allow Vercel domain

### Dependencies
- Phase 3 + 4 complete (API must be functional)
- Visual direction selected
- Vercel account created (human action)

### Deliverables
- Dashboard deployed at `https://relay-dashboard.vercel.app` (or custom domain)
- All 6 pages functional with real data
- Auto-refresh working on event stream
- Re-queue functional from DLQ page

### Testing Strategy
- Visual review of all pages with populated test data
- Re-queue flow tested end-to-end from dashboard
- Mobile layout review (responsive, readable — not necessarily mobile-optimized)
- Vercel preview deployment for every PR

### Expected Complexity: High (most frontend work concentrated here)

---

## Phase 6: Integrations
**Goal:** CareerOS, MarketMind, and TimeKeep publish real events to Relay. The relay-client SDK is published and used.

**Estimated time:** 3–5 days

### Tasks

- [ ] Complete `relay-client` SDK package:
  - `RelayClient` class with `publish()` and `publishBatch()` methods
  - TypeScript types for all event payloads (per `EVENT_SYSTEM.md` catalog)
  - Error handling and retry on 429
  - Environment-based configuration

- [ ] Integrate Relay client into CareerOS:
  - Add `RELAY_API_KEY` and `RELAY_PROJECT_ID` to CareerOS `.env`
  - Publish `career.job.ingested` on job insertion
  - Publish `career.job.scoring.requested` on scoring trigger
  - Publish `career.digest.dispatch.scheduled` from scheduler

- [ ] Implement CareerOS workflow handlers in Worker Lambda:
  - `career.job.scoring.requested` → invoke Claude scoring logic
  - `career.digest.dispatch.scheduled` → compile and send digest via Resend

- [ ] Integrate Relay client into TimeKeep:
  - Publish `timekeep.clockevent.recorded` on clock in/out
  - Publish `timekeep.notification.dispatch.requested` on schedule changes

- [ ] Implement TimeKeep workflow handlers:
  - `timekeep.notification.dispatch.requested` → send via Twilio/Resend

- [ ] Register all three projects in `relay-projects` DynamoDB table

### Dependencies
- Phase 3 + 4 complete
- CareerOS and TimeKeep partially built

### Deliverables
- `relay-client` npm package usable from other projects
- CareerOS publishing real events visible in Relay dashboard
- TimeKeep publishing real events visible in Relay dashboard
- At least 2 workflow handlers fully functional end-to-end

### Testing Strategy
- End-to-end: trigger CareerOS job scoring → verify Relay dashboard shows COMPLETED execution
- Error path: kill the Claude API key → verify retry behavior and eventual DLQ entry in dashboard

### Expected Complexity: Medium

---

## Phase 7: Production Hardening
**Goal:** The platform is ready for public portfolio demonstration. Monitoring is active, edge cases are handled, documentation is complete.

**Estimated time:** 2–3 days

### Tasks

**Reliability:**
- [ ] Verify all CloudWatch alarms are active and alerts routing to email
- [ ] Test cold start behavior of Ingest Lambda under simulated traffic
- [ ] Verify DLQ lifecycle end-to-end one final time
- [ ] Add structured error handling to all Lambda edge cases

**Security:**
- [ ] Rotate all API keys to production values
- [ ] Verify all S3 buckets have public access blocked
- [ ] Verify all IAM roles have no wildcard resource permissions
- [ ] Review API Gateway CORS config (only Vercel domain allowed)
- [ ] Add input sanitization to prevent DynamoDB injection patterns

**Performance:**
- [ ] Confirm Lambda memory allocations are appropriate (not over-provisioned)
- [ ] Enable Lambda function log level `INFO` (not DEBUG) in production
- [ ] Review DynamoDB GSI hot partition risk for high-volume event types

**Documentation:**
- [ ] Update README with production API base URL and deployment instructions
- [ ] Add API reference section to README (links to API_SPEC.md)
- [ ] Record a 2-minute demo video showing: publish event → dashboard update → DLQ entry → re-queue
- [ ] Add Relay to resume under Projects (infrastructure platform, deployed, linked)

**Resume and Portfolio:**
- [ ] Ensure Relay dashboard is publicly accessible (no auth on dashboard for portfolio purposes)
- [ ] Add `relay-dashboard.vercel.app` as live link
- [ ] Add GitHub repo link with clean README and architecture docs included

### Dependencies
- Phases 1–6 complete

### Deliverables
- Production-hardened platform
- Demo video
- Resume updated with Relay project
- GitHub repo presentable as a portfolio artifact

### Expected Complexity: Low–Medium

---

## Adjacent Skills This Project Develops

As you build Relay, you will naturally encounter and develop the following industry-relevant skills. These are not extras to add — they emerge from building the system correctly.

### Skills You Will Gain by Completing This Project

| Skill | Where It Appears | Industry Relevance |
|---|---|---|
| **Serverless architecture** | Every Lambda function | High — AWS Lambda/GCP Cloud Functions is standard |
| **Event-driven design** | SQS + Worker pattern | High — used at every scale-conscious company |
| **Queue-based systems** | SQS as the backbone | High — Kafka, SQS, RabbitMQ all share this mental model |
| **Dead-letter queues** | DLQ implementation | Medium-high — production reliability pattern |
| **Idempotency design** | Ingest + Worker | High — critical for financial and data systems |
| **Retry logic** | Exponential backoff | High — fundamental distributed systems skill |
| **Infrastructure as Code** | AWS SAM template | High — Terraform/CloudFormation/SAM on every job description |
| **IAM and least privilege** | Per-Lambda roles | High — cloud security fundamentals |
| **Structured logging** | JSON logs to CloudWatch | High — every serious engineering team expects this |
| **Observability design** | Dashboard + metrics | High — "you build it, you run it" is standard now |
| **API design** | REST API spec | High — foundational skill |
| **TypeScript in AWS Lambda** | All backend code | High — TS is standard for Node-based AWS work |
| **Webhook patterns** | Inbound/outbound webhooks | Medium-high — every SaaS integration uses this |

### Skills Worth Adding (Intentionally, Not by Default)

These skills are adjacent and valuable. Add them only if they fit naturally:

| Skill | Fit? | Recommendation |
|---|---|---|
| **CI/CD (GitHub Actions)** | Natural fit | **Add it.** Automated deploy on merge to main via `sam deploy` in a GitHub Action is 2 hours of work and demonstrates modern engineering discipline. |
| **Distributed tracing (OpenTelemetry)** | Marginal fit | Skip for now. CloudWatch provides sufficient tracing at this scale. OpenTelemetry is a future project skill. |
| **Feature flags** | No fit | Skip. No use case in an infrastructure platform at this scale. |
| **Rate limiting (advanced)** | Already included | Basic rate limiting is in the spec. Advanced sliding window algorithms would be a detour. |
| **API versioning** | Minor addition | Document it as per spec (v1 implicit). No need to implement multiple versions. |
| **Caching** | Marginal fit | Lambda cold start caching (in-process) is natural. A Redis or CDN cache layer is not justified. |
| **Multi-region deployment** | No fit | Resume-padding territory at solo-engineer scale. Not added. |
| **Container-based Lambda** | Minor option | Container images for Lambda are a valid deployment option if packages grow large. Worth knowing about but not required. |

### CI/CD Recommendation (add this)

A GitHub Actions workflow that runs `sam build && sam deploy` on merge to `main` is:
- 50–100 lines of YAML
- Demonstrates real engineering practice
- Eliminates manual deployment steps
- Directly relevant to SRE/infrastructure roles

Add this in Phase 7. It is the one non-core skill worth including because it fits so naturally.
