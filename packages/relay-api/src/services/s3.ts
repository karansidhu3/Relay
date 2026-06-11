import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });

export async function putPayload(
  bucket: string,
  key: string,
  payload: unknown,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(payload),
      ContentType: 'application/json',
    }),
  );
}

export async function getPayload(
  bucket: string,
  key: string,
): Promise<Record<string, unknown>> {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!result.Body) throw new Error(`Empty S3 object at s3://${bucket}/${key}`);

  const body = await result.Body.transformToString('utf-8');
  return JSON.parse(body) as Record<string, unknown>;
}
