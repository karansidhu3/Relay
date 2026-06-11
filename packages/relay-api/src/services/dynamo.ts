import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }),
  {
    marshallOptions: { removeUndefinedValues: true },
    unmarshallOptions: { wrapNumbers: false },
  },
);
