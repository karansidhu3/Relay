# Relay

Serverless event orchestration and observability platform built on AWS Lambda, SQS, DynamoDB, and S3 — deployed via AWS SAM, dashboarded via Next.js on Vercel.

## Architecture

```
Application → API Gateway → Lambda (Ingest) → SQS → Lambda (Worker) → DynamoDB + S3 + CloudWatch
                                                            ↓
                                                     Dead-Letter Queue
                                                            ↓
                                                     Lambda (DLQ Handler)
```

## Packages

| Package | Description |
|---|---|
| `packages/relay-api` | Lambda functions (Ingest, Worker, DLQ Handler, Scheduler, API Read) |
| `packages/relay-dashboard` | Next.js observability dashboard |
| `packages/relay-client` | TypeScript SDK for publishing events |

## Infrastructure

AWS SAM template in `infrastructure/template.yaml` defines all resources: DynamoDB tables, SQS queues, S3 buckets, Lambda functions, API Gateway, IAM roles, and CloudWatch alarms.

## Setup

```bash
# Install dependencies
npm install

# Type-check all packages
npm run typecheck

# Lint all packages
npm run lint
```

## Deployment

See `IMPLEMENTATION_ROADMAP.md` for phased deployment instructions.

## Docs

- `SYSTEM_ARCHITECTURE.md` — Architecture overview
- `DATABASE_SCHEMA.md` — DynamoDB schema and access patterns
- `API_SPEC.md` — REST API reference
- `EVENT_SYSTEM.md` — Event type catalog
- `OBSERVABILITY_SYSTEM.md` — Logging, metrics, and alerting
- `AWS_INFRASTRUCTURE.md` — SAM infrastructure details
- `FRONTEND_STRATEGY.md` — Dashboard design direction
- `IMPLEMENTATION_ROADMAP.md` — Phased build plan
