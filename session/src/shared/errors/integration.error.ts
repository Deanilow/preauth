/**
 * Catálogo local de errores para sur-appcli-customer-loan-api.
 *
 * IMPORTANTE: este servicio NO tiene acceso a BD (error_catalog). Solo
 * api1 (portfolio-query-api / internal-transfer-api) consulta BD.
 *
 * Por eso este catálogo local se usa SOLO para:
 *  1) BusinessError propios de este servicio (validaciones locales).
 *  2) Fallback de infraestructura cuando un upstream falla sin body
 *     reconocible (timeout, red, 5xx sin payload) — nunca para
 *     reemplazar un código real que sí vino en el body del upstream.
 *
 * Cualquier código real que llegue de un upstream (COBIS u otra API
 * nuestra) debe propagarse tal cual hacia arriba — ver errorNormalizer.ts,
 * Casos B y C. Solo api1 tiene la BD para decidir el mensaje/status final
 * al cliente.
 */

export const ERROR_CATALOG = {
  COBIS_LOANS_SERVICE_UNAVAILABLE: {
    code: 'COB-LOAN-UNV-001',
    status: 503,
  },
  COBIS_AUTH_SERVICE_UNAVAILABLE: {
    code: 'COB-AUTH-UNV-001',
    status: 503,
  },
  // ─── Genérico ──────────────────────────────────────────────────────────────
  UNEXPECTED_ERROR: {
    code: 'UNEXPECTED_ERROR',
    status: 500,
  },

  
  // ── Token / Transaccional ──
  INVALID_DNI: { code: 'TRA-TOK-001', status: 422, message: 'El DNI ingresado no es válido.' },
  TOKEN_GENERATION_FAILED: { code: 'TRA-TOK-002', status: 422, message: 'No se pudo generar el token de operación.' },

  // ── Autenticación ──
  MISSING_AUTH_TOKEN: { code: 'AUTH-BNS-001', status: 401, message: 'El token de autorización es obligatorio.' },
  MISSING_UNIQUE_NAME: { code: 'AUTH-BNS-002', status: 401, message: 'El token no contiene la identificación del usuario.' },
  INVALID_TOKEN_FORMAT: { code: 'AUTH-BNS-003', status: 401, message: 'El formato del token es inválido.' },

  NOTIFICATION_TYPE_NOT_FOUND: { code: 'NOT-BNS-001', status: 422, message: 'Tipo de notificación no encontrado.' },

  // ── Sesiones (Redis state machine) ──
  SESSION_NOT_FOUND: { code: 'SES-BNS-001', status: 404, message: 'Session not found or expired' },
  STEP_MISMATCH: { code: 'SES-BNS-002', status: 409, message: 'Session step mismatch' },
  SESSION_EXPIRED: { code: 'SES-BNS-003', status: 410, message: 'Session exceeded the absolute 900s TTL' },

  // ── Servicio (session-service) ──
  UNAUTHORIZED_SERVICE_CALL: { code: 'SVC-BNS-001', status: 401, message: 'API Key inválida o ausente.' },
  REQUEST_VALIDATION_ERROR: { code: 'REQ-VAL-001', status: 400, message: 'La solicitud no cumple con el formato esperado.' },


} as const;

// Alias de compatibilidad para no romper imports existentes/tests del repositorio.
export const BUSINESS_ERROR_CODES = ERROR_CATALOG;

export type ErrorCatalogKey = keyof typeof ERROR_CATALOG;

/**
 *
 * Este mapa era el origen del bug: cualquier IntegrationError con
 * sourceName no registrado aquí (o incluso registrado) hacía que el
 * código real del upstream (ej. "251033" de COBIS) se reemplazara por
 * un código genérico de este catálogo local, perdiendo la información
 * necesaria para que api1 (con BD) hiciera el match correcto.
 *
 * Ahora el código real se propaga en errorNormalizer.ts (Casos B y C).
 * Este catálogo local solo se usa para el Caso E (sin body reconocible).
 */

/**
 * Se lanza cuando un servicio HTTP externo responde con error (4xx/5xx)
 * o cuando la llamada de red falla por problemas de infraestructura
 * (timeout, DNS no resuelto, TLS inválido, ECONNREFUSED, etc.).
 *
 * Todos los errores de integración suben hasta `setErrorHandler` en server/index.ts,
 * que es el único punto donde se formatean y se devuelven al consumidor.
 *
 * Campos:
 * - `status`     → Código HTTP recibido del servicio externo (500 para fallos de red).
 * - `body`       → Body del response del servicio externo ya parseado.
 *                  `normalizeToErrorsResponse` lee este campo para propagar el
 *                  `code` y `message` original tal cual, en vez de reemplazarlo.
 * - `url`        → URL que se intentó llamar. Se incluye en los logs para trazabilidad.
 * - `requestId`  → UUID generado por `BaseClient` en cada llamada.
 *                  Permite correlacionar el log de inicio (START) con el de error.
 * - `sourceName` → Nombre del cliente que generó el error (ver SERVICE_REGISTRY).
 *                  Solo se usa hoy para logging; la resolución de mensaje final
 *                  al cliente ahora la hace api1 (que sí tiene BD).
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    public readonly url: string,
    public readonly requestId?: string,
    public readonly originalError?: unknown,
    public readonly sourceName?: string
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/**
 * Error de dominio/negocio. Construido a partir del catálogo ERROR_CATALOG.
 *
 * - `message`     → clave de negocio para trazabilidad interna
 * - `description` → detalle técnico opcional (solo para logs/soporte)
 * - `status`      → HTTP status semántico según el catálogo
 */
export class BusinessError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly description?: string;

  constructor(catalogKey: ErrorCatalogKey, technicalDetail?: string) {
    const entry = ERROR_CATALOG[catalogKey];
    super(catalogKey);
    this.name = 'BusinessError';
    this.code = entry.code;
    this.status = entry.status;
    this.description = technicalDetail;
  }
}