/**
 * Seed script — inserts a test project + workflow configs into deployed DynamoDB tables.
 *
 * Run from the project root:
 *   AWS_PROFILE=<profile> npx tsx packages/relay-api/src/scripts/seed.ts
 *
 * Prerequisite: AWS credentials with write access to relay-projects and relay-workflows.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const REGION = process.env['AWS_REGION'] ?? 'us-east-1';
const PROJECTS_TABLE = process.env['PROJECTS_TABLE'] ?? 'relay-projects';
const WORKFLOWS_TABLE = process.env['WORKFLOWS_TABLE'] ?? 'relay-workflows';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

async function seed(): Promise<void> {
  // ── Generate API key ────────────────────────────────────────────────────────
  const rawKey = `rlk_test_${randomBytes(16).toString('hex')}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 16);

  const now = new Date().toISOString();

  // ── Project: CareerOS ───────────────────────────────────────────────────────
  const project = {
    project_id: 'proj_careeeros',
    name: 'CareerOS',
    description: 'AI-powered career management platform',
    api_key_hash: keyHash,
    api_key_prefix: keyPrefix,
    is_active: true,
    contact_email: 'dev@careeeros.test',
    event_types_allowed: [
      'career.job.scoring.requested',
      'career.document.generation.requested',
      'career.digest.dispatch.scheduled',
    ],
    rate_limit_per_minute: 60,
    created_at: now,
    updated_at: now,
  };

  await client.send(
    new PutCommand({
      TableName: PROJECTS_TABLE,
      Item: project,
    }),
  );
  console.log(`✓ Project created: ${project.project_id}`);

  // ── Workflows ────────────────────────────────────────────────────────────────
  const workflowDefaults = {
    project_id: 'proj_careeeros',
    is_active: true,
    timeout_seconds: 25,
    max_attempts: 3,
    base_delay_ms: 2000,
    backoff_multiplier: 2.0,
    max_delay_ms: 30000,
    retry_on: ['TRANSIENT_ERROR', 'RATE_LIMIT', 'TIMEOUT', 'UNKNOWN'],
    no_retry_on: ['VALIDATION_ERROR', 'SCHEMA_ERROR'],
    created_at: now,
    updated_at: now,
  };

  const workflows = [
    {
      ...workflowDefaults,
      event_type: 'career.job.scoring.requested',
      workflow_id: `wf_${randomBytes(8).toString('hex')}`,
      handler_function: 'relay-worker',
      description: 'Score a job posting against candidate resume using Claude',
      tags: { domain: 'career', action: 'score' },
    },
    {
      ...workflowDefaults,
      event_type: 'career.document.generation.requested',
      workflow_id: `wf_${randomBytes(8).toString('hex')}`,
      handler_function: 'relay-worker',
      description: 'Generate resume or cover letter document',
      tags: { domain: 'career', action: 'generate' },
    },
    {
      ...workflowDefaults,
      event_type: 'career.digest.dispatch.scheduled',
      workflow_id: `wf_${randomBytes(8).toString('hex')}`,
      handler_function: 'relay-worker',
      description: 'Compile and dispatch career digest email',
      tags: { domain: 'career', action: 'digest' },
    },
  ];

  for (const wf of workflows) {
    await client.send(new PutCommand({ TableName: WORKFLOWS_TABLE, Item: wf }));
    console.log(`✓ Workflow created: ${wf.event_type}`);
  }

  // ── Print credentials ────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────');
  console.log('RELAY TEST CREDENTIALS (save these — key shown once)');
  console.log('─────────────────────────────────────────────────');
  console.log(`Project ID : ${project.project_id}`);
  console.log(`API Key    : ${rawKey}`);
  console.log('─────────────────────────────────────────────────\n');

  console.log('Test with:');
  console.log(`curl -X POST https://eba0ihdlc2.execute-api.us-east-1.amazonaws.com/prod/events \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H 'x-relay-api-key: ${rawKey}' \\`);
  console.log(`  -H 'x-relay-project-id: ${project.project_id}' \\`);
  console.log(`  -d '{"event_type":"career.job.scoring.requested","payload":{"job_id":"jb_001","candidate_id":"cnd_001"}}'`);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
