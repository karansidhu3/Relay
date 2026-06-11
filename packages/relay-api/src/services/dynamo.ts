import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { getRequiredEnv } from '../lib/validate';
import type {
  RelayEvent,
  RelayExecution,
  RelayWorkflow,
  RelayProject,
  EventStatus,
  ExecutionStatus,
} from '../types/relay';

export const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }),
  {
    marshallOptions: { removeUndefinedValues: true },
    unmarshallOptions: { wrapNumbers: false },
  },
);

const config = {
  eventsTable: getRequiredEnv('EVENTS_TABLE'),
  executionsTable: getRequiredEnv('EXECUTIONS_TABLE'),
  workflowsTable: getRequiredEnv('WORKFLOWS_TABLE'),
  projectsTable: getRequiredEnv('PROJECTS_TABLE'),
};

// Builds a SET expression from a plain object, aliasing all keys to avoid reserved word conflicts.
function buildUpdateExpression(updates: Record<string, unknown>): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} {
  const parts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    const n = `#${key}`;
    const v = `:${key}`;
    parts.push(`${n} = ${v}`);
    names[n] = key;
    values[v] = value;
  }

  return {
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

// ── Project operations ────────────────────────────────────────────────────────

export async function getProject(projectId: string): Promise<RelayProject | null> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: config.projectsTable,
      Key: { project_id: projectId },
    }),
  );
  return (result.Item as RelayProject) ?? null;
}

// ── Event operations ──────────────────────────────────────────────────────────

export async function putEvent(event: RelayEvent): Promise<void> {
  await dynamoClient.send(
    new PutCommand({
      TableName: config.eventsTable,
      Item: event,
      ConditionExpression: 'attribute_not_exists(event_id)',
    }),
  );
}

export async function getEvent(eventId: string): Promise<RelayEvent | null> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: config.eventsTable,
      Key: { event_id: eventId },
    }),
  );
  return (result.Item as RelayEvent) ?? null;
}

export async function updateEventStatus(
  eventId: string,
  status: EventStatus,
  extra: Partial<Pick<RelayEvent, 'completed_at' | 'attempt_count'>> = {},
): Promise<void> {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpression({ status, updated_at: new Date().toISOString(), ...extra });

  await dynamoClient.send(
    new UpdateCommand({
      TableName: config.eventsTable,
      Key: { event_id: eventId },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }),
  );
}

export async function getEventByIdempotencyKey(
  projectId: string,
  idempotencyKey: string,
): Promise<RelayEvent | null> {
  // Looks back 24h — sufficient window for idempotency key deduplication at portfolio scale.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: config.eventsTable,
      IndexName: 'project-created-index',
      KeyConditionExpression: 'project_id = :projectId AND created_at > :since',
      FilterExpression: 'idempotency_key = :key',
      ExpressionAttributeValues: {
        ':projectId': projectId,
        ':since': since,
        ':key': idempotencyKey,
      },
      Limit: 1,
    }),
  );
  return ((result.Items?.[0]) as RelayEvent) ?? null;
}

export interface QueryEventsOptions {
  status?: EventStatus;
  since?: string;
  until?: string;
  limit?: number;
  cursor?: string;
}

export async function queryEventsByProject(
  projectId: string,
  options: QueryEventsOptions = {},
): Promise<{ events: RelayEvent[]; cursor?: string }> {
  const since = options.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(options.limit ?? 50, 200);

  const filterParts: string[] = [];
  const attrNames: Record<string, string> = {};
  const attrValues: Record<string, unknown> = {
    ':projectId': projectId,
    ':since': since,
  };

  if (options.status) {
    filterParts.push('#status = :status');
    attrNames['#status'] = 'status';
    attrValues[':status'] = options.status;
  }
  if (options.until) {
    filterParts.push('created_at < :until');
    attrValues[':until'] = options.until;
  }

  const params: QueryCommandInput = {
    TableName: config.eventsTable,
    IndexName: 'project-created-index',
    KeyConditionExpression: 'project_id = :projectId AND created_at > :since',
    ExpressionAttributeValues: attrValues,
    ScanIndexForward: false,
    Limit: limit,
  };

  if (filterParts.length > 0) {
    params.FilterExpression = filterParts.join(' AND ');
    params.ExpressionAttributeNames = attrNames;
  }

  if (options.cursor) {
    params.ExclusiveStartKey = JSON.parse(
      Buffer.from(options.cursor, 'base64').toString('utf8'),
    ) as Record<string, unknown>;
  }

  const result = await dynamoClient.send(new QueryCommand(params));
  const cursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : undefined;

  return { events: (result.Items ?? []) as RelayEvent[], cursor };
}

export async function getEventWithExecutions(
  eventId: string,
): Promise<{ event: RelayEvent; executions: RelayExecution[] } | null> {
  const [eventResult, executionsResult] = await Promise.all([
    dynamoClient.send(
      new GetCommand({ TableName: config.eventsTable, Key: { event_id: eventId } }),
    ),
    dynamoClient.send(
      new QueryCommand({
        TableName: config.executionsTable,
        KeyConditionExpression: 'event_id = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId },
        ScanIndexForward: true,
      }),
    ),
  ]);

  if (!eventResult.Item) return null;

  return {
    event: eventResult.Item as RelayEvent,
    executions: (executionsResult.Items ?? []) as RelayExecution[],
  };
}

// ── Execution operations ──────────────────────────────────────────────────────

export async function getExecution(
  eventId: string,
  attempt: number,
): Promise<RelayExecution | null> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: config.executionsTable,
      Key: { event_id: eventId, attempt },
    }),
  );
  return (result.Item as RelayExecution) ?? null;
}

export async function putExecution(execution: RelayExecution): Promise<void> {
  await dynamoClient.send(
    new PutCommand({
      TableName: config.executionsTable,
      Item: execution,
      ConditionExpression: 'attribute_not_exists(event_id)',
    }),
  );
}

export async function updateExecution(
  eventId: string,
  attempt: number,
  updates: Partial<
    Pick<
      RelayExecution,
      | 'status'
      | 'completed_at'
      | 'duration_ms'
      | 'error_type'
      | 'error_message'
      | 'error_stack'
      | 'output_ref'
    >
  >,
): Promise<void> {
  const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
    buildUpdateExpression(updates as Record<string, unknown>);

  await dynamoClient.send(
    new UpdateCommand({
      TableName: config.executionsTable,
      Key: { event_id: eventId, attempt },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }),
  );
}

// ── Workflow operations ───────────────────────────────────────────────────────

export async function getWorkflow(
  projectId: string,
  eventType: string,
): Promise<RelayWorkflow | null> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: config.workflowsTable,
      Key: { project_id: projectId, event_type: eventType },
    }),
  );
  return (result.Item as RelayWorkflow) ?? null;
}

// ── Dashboard overview ────────────────────────────────────────────────────────

export interface OverviewStats {
  period: string;
  total_events: number;
  completed: number;
  failed: number;
  dead_lettered: number;
  processing: number;
  success_rate: number;
  avg_execution_ms: number;
  events_by_project: unknown[];
  events_by_type: unknown[];
}

async function countEventsByStatus(status: EventStatus, since: string): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: config.eventsTable,
        IndexName: 'status-updated-index',
        KeyConditionExpression: '#status = :status AND updated_at > :since',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status, ':since': since },
        Select: 'COUNT',
        ExclusiveStartKey: lastKey,
      }),
    );
    count += result.Count ?? 0;
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return count;
}

async function getRecentCompletedExecutions(since: string): Promise<RelayExecution[]> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: config.executionsTable,
      IndexName: 'status-started-index',
      KeyConditionExpression: '#status = :status AND started_at > :since',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'COMPLETED' as ExecutionStatus, ':since': since },
      ProjectionExpression: 'duration_ms',
      Limit: 500,
    }),
  );
  return (result.Items ?? []) as RelayExecution[];
}

export async function getDashboardOverview(since: string): Promise<OverviewStats> {
  const [completed, failed, deadLettered, processing, executions] = await Promise.all([
    countEventsByStatus('COMPLETED', since),
    countEventsByStatus('FAILED', since),
    countEventsByStatus('DEAD_LETTERED', since),
    countEventsByStatus('PROCESSING', since),
    getRecentCompletedExecutions(since),
  ]);

  const total = completed + failed + deadLettered + processing;
  const successRate = total > 0 ? completed / total : 0;
  const avgDuration =
    executions.length > 0
      ? executions.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) / executions.length
      : 0;

  return {
    period: '24h',
    total_events: total,
    completed,
    failed,
    dead_lettered: deadLettered,
    processing,
    success_rate: Math.round(successRate * 1000) / 1000,
    avg_execution_ms: Math.round(avgDuration),
    events_by_project: [],
    events_by_type: [],
  };
}
