import { BusinessError } from 'src/shared/errors/integration.error';

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  label?: string;
}

const NON_RETRYABLE_BUSINESS_CODES = new Set([
  'CLIENT_INACTIVE',
  'PRODUCT_NOT_FOUND',
  'VALIDATION_ERROR',
  'NOTIFICATION_TYPE_NOT_FOUND',
  'MISSING_AUTH_TOKEN',
  'INVALID_TOKEN_FORMAT',
  'MISSING_UNIQUE_NAME',
  'CLIENT_NOT_REGISTERED',
]);

const NON_RETRYABLE_HTTP_STATUS = new Set([400, 401, 403, 404, 422]);

function isRetryable(err: unknown): boolean {
  if (err instanceof BusinessError) {
    return !NON_RETRYABLE_BUSINESS_CODES.has((err as any).code);
  }
  const status = (err as any)?.statusCode ?? (err as any)?.status;
  if (typeof status === 'number') {
    return !NON_RETRYABLE_HTTP_STATUS.has(status);
  }
  return true;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, delayMs = 500, label = 'operation' } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err)) {
        console.warn(`[Retry] ${label} → non-retryable, skip → ${(err as Error)?.message ?? err}`);
        throw err;
      }

      if (attempt === attempts) {
        console.error(`[Retry] ${label} FAILED after ${attempts} attempts → ${(err as Error)?.message ?? err}`);
        break;
      }

      const wait = delayMs * Math.pow(2, attempt - 1);
      console.warn(`[Retry] ${label} attempt ${attempt}/${attempts} failed → retry in ${wait}ms → ${(err as Error)?.message ?? err}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  throw lastError;
}