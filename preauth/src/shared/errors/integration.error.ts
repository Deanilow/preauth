/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ERROR WRAPPER — Centraliza el manejo de errores de toda la API.
 * Resolución 100% en código (BUSINESS_ERROR_CODES), sin BD ni cache.
 *
 * Prioridad de resolución para BusinessError:
 *   1. BUSINESS_ERROR_CODES → status/message de la entrada local
 *   2. HARDCODED_FALLBACK   → 500 genérico (solo si la entrada no tiene message)
 *
 * Prioridad de resolución para IntegrationError:
 *   1. code propio (si matchea alguna entrada de BUSINESS_ERROR_CODES)
 *   2. PROVIDER_FALLBACK_CODE (por sourceSystem)
 *   3. SERVICE_UNAVAILABLE_CODE_MAP (por serviceName)
 *   4. HARDCODED_FALLBACK
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { ErrorItem } from '../types/wrapper';

export type { ErrorItem };

type ErrorHandlerResult = {
  status: number;
  error: ErrorItem;
};

// ─── Catálogo in-memory de reglas de negocio ─────────────────────────────────
// Cada key es el identificador semántico que usas al lanzar: throw new BusinessError('KEY')
//
// Campos:
//   code    → código expuesto al cliente (ej: 'TRF-BNS-001')
//   status  → HTTP status code de fallback (si BD no responde)
//   message → (OPCIONAL) mensaje al cliente de fallback. Si no se define,
//             el error depende 100% de BD; si BD tampoco lo tiene → HARDCODED_FALLBACK.

export const BUSINESS_ERROR_CODES = {
  DB_UNAVAILABLE: { code: 'DB_UNAVAILABLE', status: 503, message: 'Servicio de datos no disponible.' },
  REQUEST_VALIDATION_ERROR: { code: 'REQ-VAL-001', status: 400, message: 'La solicitud no cumple con el formato esperado.' },

  // ── Transferencias ──
  TRANSFER_SAME_ACCOUNT: { code: 'TRF-BNS-001', status: 422, message: 'No se puede transferir a la misma cuenta.' },
  CLIENT_NOT_FOUND_IN_COBIS: { code: 'TRF-BNS-002', status: 422, message: 'Cliente no encontrado en el sistema core.' },
  CLIENT_INACTIVE: { code: 'TRF-BNS-003', status: 422, message: 'El cliente se encuentra inactivo.' },
  SOURCE_ACCOUNT_NOT_FOUND: { code: 'TRF-BNS-004', status: 422, message: 'Cuenta origen no encontrada.' },
  DESTINATION_ACCOUNT_NOT_FOUND: { code: 'TRF-BNS-005', status: 422, message: 'Cuenta destino no encontrada.' },
  SOURCE_ACCOUNT_INACTIVE: { code: 'TRF-BNS-006', status: 422, message: 'La cuenta origen está inactiva.' },
  VALIDATION_ERROR: { code: 'TRF-BNS-007', status: 422, message: 'Error de validación en la transferencia.' },
  TRANSFER_IN_PROGRESS: { code: 'TRF-BNS-008', status: 409, message: 'Ya existe una transferencia en curso.' },
  TRANSFER_PREVIOUSLY_FAILED: { code: 'TRF-BNS-009', status: 409, message: 'La transferencia anterior falló, reintente.' },
  IDEMPOTENCY_KEY_REUSED_DIFFERENT_PAYLOAD: { code: 'TRF-UNV-002', status: 409, message: 'Clave de idempotencia reutilizada con datos distintos.' },
  MISSING_CORRELATION_ID: { code: 'TRF-UNV-003', status: 422, message: 'Falta el identificador de correlación.' },

  // ── Productos / Portfolio ──
  PRODUCT_NOT_FOUND: { code: 'PRD-BNS-001', status: 422, message: 'Producto no encontrado.' },
  CLIENT_NOT_REGISTERED: { code: 'PRD-BNS-002', status: 422, message: 'Cliente no registrado.' },
  ORDERING_DUPLICATE_ACCOUNTS: { code: 'PRD-BNS-003', status: 422, message: 'Cuentas duplicadas en el ordenamiento.' },
  USER_NOT_LINKED: { code: 'PRD-BNS-004', status: 422, message: 'Usuario no vinculado a productos.' },
  CUSTOMER_NOT_FOUND: { code: 'PRD-BNS-005', status: 422, message: 'Cliente no encontrado.' },

  // ── Token / Transaccional ──
  INVALID_DNI: { code: 'TRA-TOK-001', status: 422, message: 'El DNI ingresado no es válido.' },
  TOKEN_GENERATION_FAILED: { code: 'TRA-TOK-002', status: 422, message: 'No se pudo generar el token de operación.' },

  // ── Autenticación ──
  MISSING_AUTH_TOKEN: { code: 'AUTH-BNS-001', status: 401, message: 'El token de autorización es obligatorio.' },
  MISSING_UNIQUE_NAME: { code: 'AUTH-BNS-002', status: 401, message: 'El token no contiene la identificación del usuario.' },
  INVALID_TOKEN_FORMAT: { code: 'AUTH-BNS-003', status: 401, message: 'El formato del token es inválido.' },

  // ── PreAuth Orchestrator ──
  BOT_DETECTED: { code: 'PRE-BNS-001', status: 403, message: 'Validación anti-bot fallida.' },
  RISK_DENIED: { code: 'PRE-BNS-002', status: 403, message: 'Solicitud denegada por el motor de riesgo.' },
  CHALLENGE_REQUIRED: { code: 'PRE-BNS-003', status: 429, message: 'Se requiere verificación adicional.' },
  CONTEXT_INIT_FAILED: { code: 'PRE-BNS-004', status: 500, message: 'No se pudo inicializar el contexto de la sesión.' },
} as const;

export type BusinessErrorCode = keyof typeof BUSINESS_ERROR_CODES;

// ─── Mapeo: serviceName → código UNV cuando el servicio no responde (timeout/red) ──
export const SERVICE_UNAVAILABLE_CODE_MAP: Record<string, string> = {
  CustomerAccountPositionService: 'POS-UNV-001',
  AccountBalancesTransactionsService: 'TXN-UNV-001',
  IdentityAccessService: 'IDN-UNV-001',
  TransactionalTransfersService: 'TRF-UNV-001',
  DocumentInformationService: 'DOC-UNV-001',
  CobisIdentifierService: 'COB-UNV-001',
  // PreAuth Orchestrator: reutilizan el code fail-closed ya definido en BUSINESS_ERROR_CODES
  // (mismo status/mensaje que cuando el propio use case detecta bot/riesgo/fallo de contexto),
  // por si algún IntegrationError de estos clientes llegara sin pasar por el catch explícito.
  AntiBotService: 'PRE-BNS-001',
  RiskEngineService: 'PRE-BNS-002',
  TokenService: 'PRE-BNS-004',
  SessionService: 'PRE-BNS-004',
};

// ─── Mapeo: sourceSystem → código BIZ genérico cuando el code del proveedor no está en BD ──
const PROVIDER_FALLBACK_CODE: Record<string, string> = {
  COBIS: 'COB-BIZ-001',
  POSITION_API: 'POS-BIZ-001',
  BALANCE_TRANSACTIONS_API: 'TXN-BIZ-001',
  IDENTITY_API: 'IDN-BIZ-001',
  INTERNAL_TRANSACTIONS_API: 'TRF-BIZ-001',
  DOCUMENT_INFORMATION_API: 'DOC-BIZ-001',
};

type ResolvedError = { errorCode: string; clientMessage: string; httpStatus: number };

// Último recurso absoluto — solo cuando no hay match ni message local
const HARDCODED_FALLBACK: ResolvedError = {
  errorCode: 'UNEXPECTED_ERROR',
  clientMessage: 'Ocurrió un error inesperado. Por favor, intente de nuevo más tarde.',
  httpStatus: 500,
};

// ─── Clases de error ──────────────────────────────────────────────────────────

/**
 * Error de integración — servicio externo respondió con error o no respondió.
 * sourceName identifica qué servicio falló (para mapear código UNV/BIZ en BD).
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    public readonly url: string,
    public readonly requestId?: string,
    public readonly originalError?: unknown,
    public readonly sourceName?: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/**
 * Error de negocio — regla de negocio violada en nuestra lógica interna.
 *
 * Uso:
 *   throw new BusinessError('CUSTOMER_NOT_FOUND')
 *   throw new BusinessError('CUSTOMER_NOT_FOUND', `customerId=${id}`)
 *
 * Resolución del mensaje al cliente (en orden):
 *   1. BUSINESS_ERROR_CODES tiene message → message y status local
 *   2. No tiene message local              → HARDCODED_FALLBACK 500
 *
 * description es solo para trazabilidad/logs — nunca se muestra al usuario final.
 */
export class BusinessError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly clientMessage: string | undefined;
  public readonly description?: string;

  constructor(catalogKey: BusinessErrorCode, technicalDetail?: string) {
    const entry = BUSINESS_ERROR_CODES[catalogKey];
    super(catalogKey);
    this.name = 'BusinessError';
    this.code = entry.code;
    this.status = entry.status;
    this.clientMessage = 'message' in entry ? entry.message : undefined;
    this.description = technicalDetail;
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

type ProviderErrorItem = { code?: string | number; message?: string };

type UpstreamBody =
  | { kind: 'errors'; items: ErrorItem[]; sourceSystem?: string }
  | { kind: 'error'; items: ProviderErrorItem[]; rootMessage?: string; sourceSystem: string }
  | { kind: 'none' };

// Mapea serviceName → sourceSystem lógico para búsqueda en catálogo BD
const SOURCE_SYSTEM_MAP: Record<string, string> = {
  CustomerAccountPositionService: 'POSITION_API',
  AccountBalancesTransactionsService: 'BALANCE_TRANSACTIONS_API',
  IdentityAccessService: 'IDENTITY_API',
  TransactionalTransfersService: 'INTERNAL_TRANSACTIONS_API',
  DocumentInformationService: 'DOCUMENT_INFORMATION_API',
  AntiBotService: 'ANTI_BOT_API',
  RiskEngineService: 'RISK_ENGINE_API',
  TokenService: 'TOKEN_SERVICE_API',
  SessionService: 'SESSION_SERVICE_API',
};

function detectSourceSystem(sourceName?: string): string {
  return (sourceName ? SOURCE_SYSTEM_MAP[sourceName] : undefined) ?? 'EXTERNAL';
}

/** Normaliza el body upstream a una estructura conocida para extraer code/message */
function extractUpstream(body: unknown, sourceName?: string): UpstreamBody {
  const b = body as any;
  if (Array.isArray(b?.errors) && b.errors.length > 0) {
    return { kind: 'errors', items: b.errors, sourceSystem: detectSourceSystem(sourceName) };
  }
  if (Array.isArray(b?.error) && b.error.length > 0) {
    return { kind: 'error', items: b.error, rootMessage: b.message, sourceSystem: detectSourceSystem(sourceName) };
  }
  return { kind: 'none' };
}

// ─── Resolución en código (BUSINESS_ERROR_CODES) ─────────────────────────────

// Índice inverso code→entry, construido una sola vez a partir de BUSINESS_ERROR_CODES
const CODE_TO_ENTRY: Record<string, ResolvedError> = Object.values(BUSINESS_ERROR_CODES).reduce(
  (acc, entry) => {
    if ('message' in entry && entry.message) {
      acc[entry.code] = { errorCode: entry.code, clientMessage: entry.message, httpStatus: entry.status };
    }
    return acc;
  },
  {} as Record<string, ResolvedError>,
);

function resolveByCode(code: string): ResolvedError | undefined {
  return CODE_TO_ENTRY[code];
}

/**
 * Resolución con fallbacks encadenados (solo para IntegrationError):
 *   code propio → PROVIDER_FALLBACK_CODE → SERVICE_UNAVAILABLE_CODE_MAP → HARDCODED_FALLBACK
 */
function resolveFallback(sourceSystem: string, serviceName?: string): ResolvedError {
  const providerFallbackCode = PROVIDER_FALLBACK_CODE[sourceSystem];
  const providerFallback = providerFallbackCode ? resolveByCode(providerFallbackCode) : undefined;
  if (providerFallback) return providerFallback;

  const svcCode = serviceName ? SERVICE_UNAVAILABLE_CODE_MAP[serviceName] : undefined;
  const svcFallback = svcCode ? resolveByCode(svcCode) : undefined;
  if (svcFallback) return svcFallback;

  return HARDCODED_FALLBACK;
}

// ─── Resolvers por tipo de error ──────────────────────────────────────────────

/**
 * Resolución para BusinessError:
 *   1. Entry tiene message    → status/message local de BUSINESS_ERROR_CODES
 *   2. Entry NO tiene message → HARDCODED_FALLBACK 500
 */
function resolveBusinessError(e: BusinessError): ErrorHandlerResult {
  if (e.clientMessage) {
    return {
      status: e.status,
      error: {
        code: e.code,
        message: e.clientMessage,
        level: 'error',
        description: e.description,
      },
    };
  }

  console.warn(`[buildErrorWrapper] code=${e.code} sin message local → HARDCODED_FALLBACK`);
  return {
    status: HARDCODED_FALLBACK.httpStatus,
    error: {
      code: HARDCODED_FALLBACK.errorCode,
      message: HARDCODED_FALLBACK.clientMessage,
      level: 'error',
      description: e.description,
    },
  };
}

// ─── Helpers para resolveIntegrationError (reducir Cognitive Complexity) ──────

type ParsedOriginals = {
  originalCode: string;
  originalMessage: string;
  nestedUpstream: unknown;
};

/** Intenta parsear el description como JSON para extraer codes anidados */
function tryParseNestedDescription(description: string): ParsedOriginals | undefined {
  try {
    const desc = JSON.parse(description);
    if (desc?.upstream?.error?.[0]) {
      return {
        originalCode:    String(desc.upstream.error[0].code ?? ''),
        originalMessage: String(desc.upstream.error[0].message ?? ''),
        nestedUpstream:  desc.upstream,
      };
    }
    if (desc?.originalCode && desc.originalCode !== 'UNEXPECTED_ERROR') {
      return {
        originalCode:    desc.originalCode,
        originalMessage: desc.originalMessage ?? '',
        nestedUpstream:  undefined,
      };
    }
  } catch { /* description no parseable */ }
  return undefined;
}

/** Extrae code/message originales del body upstream, incluyendo descripción anidada */
function parseUpstreamOriginals(upstream: UpstreamBody & { kind: 'errors' | 'error' }): ParsedOriginals {
  const firstItem     = upstream.items[0];
  const firstCode     = String(firstItem?.code ?? '');
  const firstMessage  = String((firstItem as any)?.message ?? '');

  let originalCode    = firstCode;
  let originalMessage = firstMessage;
  let nestedUpstream: unknown = undefined;

  if (upstream.kind === 'errors' && (firstItem as any)?.description) {
    const parsed = tryParseNestedDescription((firstItem as any).description);
    if (parsed) {
      originalCode    = parsed.originalCode ?? originalCode;
      originalMessage = parsed.originalMessage ?? originalMessage;
      nestedUpstream  = parsed.nestedUpstream;
    }
  }

  return { originalCode, originalMessage, nestedUpstream };
}

/** Resuelve IntegrationError cuando hay body con errors/error */
function resolveWithUpstreamBody(
  ie: IntegrationError,
  upstream: UpstreamBody & { kind: 'errors' | 'error' },
): ErrorHandlerResult {
  const sourceSystem = upstream.sourceSystem ?? detectSourceSystem(ie.sourceName);
  const { originalCode, originalMessage, nestedUpstream } = parseUpstreamOriginals(upstream);

  const resolved =
    resolveByCode(originalCode)
    ?? (originalMessage && originalMessage !== originalCode ? resolveByCode(originalMessage) : undefined)
    ?? resolveFallback(sourceSystem, ie.sourceName);

  const isHardcodedFallback = resolved.errorCode === HARDCODED_FALLBACK.errorCode;
  const rootMessage = 'rootMessage' in upstream ? upstream.rootMessage : undefined;

  return {
    status: isHardcodedFallback ? ie.status : resolved.httpStatus,
    error: {
      code:    isHardcodedFallback ? HARDCODED_FALLBACK.errorCode    : resolved.errorCode,
      message: isHardcodedFallback ? HARDCODED_FALLBACK.clientMessage : resolved.clientMessage,
      level: 'error',
      description: JSON.stringify({
        originalCode,
        originalMessage,
        source: ie.sourceName,
        upstreamStatus: ie.status,
        url: ie.url,
        requestId: ie.requestId,
        ...(rootMessage    ? { rootMessage }    : {}),
        ...(nestedUpstream ? { nestedUpstream } : {}),
      }),
    },
  };
}

/** Resuelve IntegrationError cuando no hay body (timeout/red/sin respuesta) */
function resolveWithoutUpstreamBody(ie: IntegrationError): ErrorHandlerResult {
  const resolved = resolveFallback(detectSourceSystem(ie.sourceName), ie.sourceName);

  if (resolved.errorCode === HARDCODED_FALLBACK.errorCode) {
    console.warn(`[buildErrorWrapper] UNMAPPED service=${ie.sourceName}`);
  }

  return {
    status: resolved.httpStatus,
    error: {
      code: resolved.errorCode,
      message: resolved.clientMessage,
      level: 'error',
      description: JSON.stringify({
        source: ie.sourceName,
        url: ie.url,
        requestId: ie.requestId,
        upstreamStatus: ie.status,
      }),
    },
  };
}

/**
 * Resolución para IntegrationError — error propagado desde un servicio externo.
 * Intenta extraer el code real del body upstream (incluso si ya pasó por otro buildErrorWrapper).
 */
function resolveIntegrationError(ie: IntegrationError): ErrorHandlerResult {
  const upstream = extractUpstream(ie.body, ie.sourceName);

  if (upstream.kind === 'errors' || upstream.kind === 'error') {
    return resolveWithUpstreamBody(ie, upstream);
  }

  return resolveWithoutUpstreamBody(ie);
}

/** Error inesperado — no es BusinessError ni IntegrationError */
function resolveUnexpected(error: unknown): ErrorHandlerResult {
  return {
    status: HARDCODED_FALLBACK.httpStatus,
    error: {
      code: HARDCODED_FALLBACK.errorCode,
      message: HARDCODED_FALLBACK.clientMessage,
      level: 'error',
      description: JSON.stringify({
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    },
  };
}

/** Error de validación de schema de Fastify (body/params/query no cumplen el JSON Schema) */
function isFastifySchemaValidationError(error: unknown): error is Error & { validation: unknown[] } {
  return typeof error === 'object' && error !== null && Array.isArray((error as { validation?: unknown }).validation);
}

function resolveSchemaValidationError(error: Error): ErrorHandlerResult {
  const entry = BUSINESS_ERROR_CODES.REQUEST_VALIDATION_ERROR;
  return {
    status: entry.status,
    error: {
      code: entry.code,
      message: entry.message,
      level: 'error',
      description: error.message,
    },
  };
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────

/**
 * Punto de entrada único para resolver cualquier error en un response estandarizado.
 * Usar en catch de controllers, preHandlers y error handlers globales de Fastify.
 *
 * Ejemplo:
 *   const result = await buildErrorWrapper(error);
 *   reply.status(result.status).send({ error: result.error });
 */
export async function buildErrorWrapper(error: unknown): Promise<ErrorHandlerResult> {
  if (error instanceof BusinessError) return resolveBusinessError(error);
  if (error instanceof IntegrationError) return resolveIntegrationError(error);
  if (isFastifySchemaValidationError(error)) return resolveSchemaValidationError(error);
  return resolveUnexpected(error);
}