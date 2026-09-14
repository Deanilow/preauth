import { randomUUID } from "crypto";
import { maskSensitiveHeaders } from "../../../shared/utils/object.utils";
import { HttpClientService } from "../http/http-client.service";
import { logger } from "../logger";
import { IntegrationError } from "src/shared/errors/integration.error";

export interface ClientRetryOptions {
  attempts?: number;
  delayMs?: number;
}

const DEFAULT_RETRY: ClientRetryOptions = { attempts: 3, delayMs: 500 };

const NON_RETRYABLE_HTTP_STATUS = new Set([400, 401, 403, 404, 422]);

export abstract class BaseClient {
  constructor(
    protected readonly httpClient: HttpClientService,
    protected readonly baseUrl: string,
    protected readonly timeoutMs: number,
    private readonly clientName: string,
  ) { }

  protected async executeRequestApi<T = unknown>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    headers: Record<string, string> = {},
    body?: unknown,
    retry?: boolean | ClientRetryOptions,
  ): Promise<T> {
    if (!retry) {
      return this.doRequest<T>(method, path, headers, body);
    }

    const opts = retry === true ? DEFAULT_RETRY : { ...DEFAULT_RETRY, ...retry };
    const { attempts, delayMs } = opts;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts!; attempt++) {
      try {
        return await this.doRequest<T>(method, path, headers, body);
      } catch (err) {
        lastError = err;

        if (!this.isRetryable(err)) {
          throw err;
        }

        if (attempt === attempts) {
          logger.error(
            { client: this.clientName, method, path, attempts },
            `[${this.clientName}] RETRY EXHAUSTED after ${attempts} attempts`,
          );
          break;
        }

        const wait = delayMs! * Math.pow(2, attempt - 1);
        logger.warn(
          { client: this.clientName, method, path, attempt, maxAttempts: attempts, nextRetryMs: wait },
          `[${this.clientName}] RETRY ${attempt}/${attempts} → next in ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    throw lastError;
  }

  private async doRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    const requestId = randomUUID();
    const url = `${this.baseUrl}${path}`;

    logger.info(
      { client: this.clientName, requestId, method, url, timeoutMs: this.timeoutMs, headers: maskSensitiveHeaders(headers) },
      `[${this.clientName}] START`,
    );

    let response: Awaited<ReturnType<typeof this.httpClient.request>>;
    try {
      response = await this.httpClient.request(url, {
        method,
        headers,
        body,
        timeout: this.timeoutMs,
      });
    } catch (networkError) {
      const e = networkError as Error & { code?: string };
      logger.error(
        { client: this.clientName, requestId, method, url, errorName: e.name, errorCode: e.code ?? 'none', errorMessage: e.message },
        `[${this.clientName}] NETWORK ERROR`,
      );
      throw new IntegrationError(
        e.message || 'Unknown error',
        500,
        undefined,
        url,
        requestId,
        undefined,
        this.clientName,
      );
    }

    const contentType = (response.headers['content-type'] as string) ?? '';
    const payload = contentType.includes('application/json')
      ? await response.body.json()
      : await response.body.text();

    if (response.statusCode >= 400) {
      logger.error(
        { client: this.clientName, requestId, method, url, statusCode: response.statusCode, body: payload },
        `[${this.clientName}] UPSTREAM ERROR`,
      );
      throw new IntegrationError(
        `${this.clientName} responded with status ${response.statusCode}`,
        response.statusCode,
        payload,
        url,
        requestId,
        undefined,
        this.clientName,
      );
    }

    logger.info(
      { client: this.clientName, requestId, method, url, statusCode: response.statusCode },
      `[${this.clientName}] OK`,
    );

    return payload as T;
  }

  private isRetryable(err: unknown): boolean {
    const status = (err as any)?.statusCode ?? (err as any)?.status;
    if (typeof status === 'number') {
      return !NON_RETRYABLE_HTTP_STATUS.has(status);
    }
    return true; 
  }
}