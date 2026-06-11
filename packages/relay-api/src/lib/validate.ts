import { ValidationError, PayloadTooLargeError } from './errors';

const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
const MAX_PAYLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const S3_OFFLOAD_THRESHOLD_BYTES = 200 * 1024;

export function validateEventType(eventType: string): void {
  if (!eventType) {
    throw new ValidationError('event_type is required', 'event_type');
  }
  if (!EVENT_TYPE_PATTERN.test(eventType)) {
    throw new ValidationError(
      'event_type must be dot-notation lowercase (e.g. career.job.scoring.requested)',
      'event_type',
    );
  }
}

export function validatePayloadSize(payloadBytes: number): void {
  if (payloadBytes > MAX_PAYLOAD_SIZE_BYTES) {
    throw new PayloadTooLargeError(payloadBytes);
  }
}

export function requiresS3Offload(payloadBytes: number): boolean {
  return payloadBytes > S3_OFFLOAD_THRESHOLD_BYTES;
}

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}
