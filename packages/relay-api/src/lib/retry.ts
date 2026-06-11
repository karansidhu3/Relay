interface RetryConfig {
  baseDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 2000,
  backoffMultiplier: 2.0,
  maxDelayMs: 30000,
};

export function calculateBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

export function shouldRetry(
  errorType: string,
  retryOn: string[],
  noRetryOn: string[],
): boolean {
  if (noRetryOn.includes(errorType)) return false;
  return retryOn.includes(errorType);
}
