import { SQSClient, SendMessageCommand, ChangeMessageVisibilityCommand } from '@aws-sdk/client-sqs';
import type { RelaySQSMessage } from '../types/relay';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

export async function publishToMainQueue(message: RelaySQSMessage): Promise<void> {
  const queueUrl = process.env['MAIN_QUEUE_URL'];
  if (!queueUrl) throw new Error('Required environment variable MAIN_QUEUE_URL is not set');

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: undefined,
    }),
  );
}

export async function changeMessageVisibility(
  receiptHandle: string,
  queueUrl: string,
  visibilityTimeoutSeconds: number,
): Promise<void> {
  await sqsClient.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: Math.min(visibilityTimeoutSeconds, 43200),
    }),
  );
}
