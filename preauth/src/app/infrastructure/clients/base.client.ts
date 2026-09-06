import { randomUUID } from "crypto";
import { maskSensitiveHeaders } from "../../../shared/utils/object.utils";
import { HttpClientService } from "../http/http-client.service";
import { logger } from "../logger";
import { IntegrationError } from "src/shared/errors/integration.error";

/**
 * Clase base para todos los clientes HTTP de integración.
 *
 * Responsabilidades:
 * - Generar un `requestId` único por llamada para correlacionar logs.
 * - Loguear el inicio (START), éxito (OK) y error (UPSTREAM ERROR / NETWORK ERROR)
 *   de cada petición con datos estructurados.
 * - Enmascarar cabeceras sensibles (Authorization, x-api-key) antes de loguear.
 * - Lanzar `IntegrationError` en cualquier caso de fallo, para que
 *   `buildErrorWrapper` lo capture y lo formatee uniformemente.
 *
 * Las subclases sólo deben llamar a `executeRequestApi` y nunca
 * manejar errores HTTP por su cuenta.
 */
export abstract class BaseClient {
  constructor(
    protected readonly httpClient: HttpClientService,
    protected readonly baseUrl: string,
    protected readonly timeoutMs: number,
    private readonly clientName: string
  ) {}

  protected async executeRequestApi<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    headers: Record<string, string> = {},
    body?: unknown
  ): Promise<T> {
    const requestId = randomUUID();
    const url = `${this.baseUrl}${path}`;

    logger.info(
      { client: this.clientName, requestId, method, url, timeoutMs: this.timeoutMs, headers: maskSensitiveHeaders(headers) },
      `[${this.clientName}] START`
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
        `[${this.clientName}] NETWORK ERROR`
      );
      throw new IntegrationError(
        e.message || 'Unknown error',
        500,
        undefined,
        url,
        requestId,
        undefined,
        this.clientName  // ← sourceName para que buildErrorWrapper sepa qué servicio falló
      );
    }

    const contentType = (response.headers['content-type'] as string) ?? '';
    const payload = contentType.includes('application/json')
      ? await response.body.json()
      : await response.body.text();

    if (response.statusCode >= 400) {
      logger.error(
        { client: this.clientName, requestId, method, url, statusCode: response.statusCode, body: payload },
        `[${this.clientName}] UPSTREAM ERROR`
      );
      throw new IntegrationError(
        `${this.clientName} responded with status ${response.statusCode}`,
        response.statusCode,
        payload,
        url,
        requestId,
        undefined,
        this.clientName  // ← sourceName
      );
    }

    logger.info(
      { client: this.clientName, requestId, method, url, statusCode: response.statusCode },
      `[${this.clientName}] OK`
    );

    return payload as T;
  }
}