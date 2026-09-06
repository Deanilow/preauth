import { FastifyRequest } from 'fastify';
import { safeJsonParse } from '../utils/object.utils';
import { BUSINESS_ERROR_CODES, BusinessError, ERROR_CATALOG, IntegrationError } from './integration.error';

export const CONTRACT_STATUS_CODES = [400, 401, 403, 404, 422, 500, 502, 503] as const;
export type ContractStatusCode = (typeof CONTRACT_STATUS_CODES)[number];

export const DEFAULT_ERROR_MESSAGE = 'Se presentado un error durante el procesamiento de la solicitud - [appcli-customer-loan-api]';
export const DEFAULT_ERROR_CODE = 'back-cust-loan';

export interface ErrorItem {
  code: string;
  message: string;
  level: 'error' | 'warning' | 'info';
  description?: string;
}

export interface ErrorResponse {
  errors: ErrorItem[];
}

export function normalizeContractStatusCode(status: number): ContractStatusCode {
  return (CONTRACT_STATUS_CODES as readonly number[]).includes(status)
    ? (status as ContractStatusCode)
    : 500;
}

interface DescriptionContext {
  req: FastifyRequest;
  statusCode: number;
  err: Record<string, unknown>;
  upstream?: unknown;
}

function buildDescription(ctx: DescriptionContext, extra?: Record<string, unknown>): string {
  const requestId = ctx.req.headers?.['x-request-id'];

  const request: Record<string, unknown> = { path: ctx.req.url };
  if (requestId) request.requestId = requestId;

  const integration: Record<string, unknown> = { status: ctx.statusCode };
  if (ctx.err.url) integration.url = ctx.err.url;
  if (ctx.err.requestId) integration.requestId = ctx.err.requestId;

  const payload: Record<string, unknown> = { request, integration, ...extra };
  if (ctx.upstream !== undefined) payload.upstream = ctx.upstream;

  return JSON.stringify(payload);
}

// ─── Formato COBIS: { message, error: [{ code, message }] } ────────────────

interface CobisErrorItem {
  code?: string;
  message?: string;
  id?: string;
  path?: string;
  url?: string;
}

interface CobisUpstream {
  message?: string;
  error: CobisErrorItem[];
}

function isCobisUpstream(value: unknown): value is CobisUpstream {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as CobisUpstream).error)
  );
}

// ─── Formato ya normalizado (viene de otra API nuestra): { errors: [...] } ──

interface NormalizedUpstream {
  errors: Array<{ code?: string; message?: string; level?: string; description?: string }>;
}

function isNormalizedUpstream(value: unknown): value is NormalizedUpstream {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as NormalizedUpstream).errors) &&
    (value as NormalizedUpstream).errors.length > 0
  );
}

function resolveBusinessCodeFromMessage(message?: string): string | undefined {
  if (!message) return undefined;
  if (!(message in BUSINESS_ERROR_CODES)) return undefined;
  return BUSINESS_ERROR_CODES[message as keyof typeof BUSINESS_ERROR_CODES].code;
}

// ─── Case builders ────────────────────────────────────────────────────────

// CASO 1: upstream con formato COBIS crudo { message, error: [...] }
// api2 NO TIENE BD -> NO reemplaza el code por nada genérico.
// Propaga el code/message reales tal cual, para que api1 (que sí tiene BD)
// pueda hacer el match por source_code + source_system.
function buildCobisErrors(upstream: CobisUpstream, ctx: DescriptionContext): ErrorItem[] {
  const validItems = upstream.error.filter(
    (item): item is CobisErrorItem => typeof item === 'object' && item !== null,
  );

  const fallbackMessage = upstream.message ?? DEFAULT_ERROR_MESSAGE;

  if (validItems.length === 0) {
    return [
      {
        code: DEFAULT_ERROR_CODE,
        message: fallbackMessage,
        level: 'error',
        description: buildDescription(ctx),
      },
    ];
  }

  return validItems.map((item) => ({
    code: item.code ?? resolveBusinessCodeFromMessage(item.message) ?? DEFAULT_ERROR_CODE,
    message: item.message ?? upstream.message ?? DEFAULT_ERROR_MESSAGE,
    level: 'error' as const,
    description: buildDescription(ctx),
  }));
}

// CASO 2: upstream que YA viene normalizado como { errors: [...] } desde otra
// API nuestra (ej. api3 respondiendo con su propio contrato). Se propaga
// el code/message reales sin tocarlos — NUNCA reemplazar por UNEXPECTED_ERROR
// aquí, porque esta capa no tiene BD para decidir algo mejor.
function buildNormalizedErrors(upstream: NormalizedUpstream, ctx: DescriptionContext): ErrorItem[] {
  return upstream.errors.map((item) => ({
    code: item.code ?? DEFAULT_ERROR_CODE,
    message: item.message ?? DEFAULT_ERROR_MESSAGE,
    level: 'error' as const,
    description: buildDescription(ctx),
  }));
}

// CASO 3: IntegrationError sin body estructurado reconocible (timeout, red,
// error 5xx sin payload). Aquí SÍ es correcto usar el catálogo local de
// infraestructura (ERROR_CATALOG), porque no hay ningún código real que propagar.
function buildIntegrationErrorResponse(ie: IntegrationError, ctx: DescriptionContext): ErrorItem {
  const entry = ERROR_CATALOG.UNEXPECTED_ERROR;
  return {
    code: entry.code,
    message: DEFAULT_ERROR_MESSAGE,
    level: 'error',
    description: buildDescription(ctx),
  };
}

function buildValidationErrors(
  validationItems: Array<{ message?: string; instancePath?: string; schemaPath?: string }>,
  ctx: DescriptionContext,
): ErrorItem[] {
  if (validationItems.length === 0) {
    return [
      {
        code: DEFAULT_ERROR_CODE,
        message: 'Invalid request',
        level: 'error',
        description: buildDescription(ctx),
      },
    ];
  }

  return validationItems.map((item) => ({
    code: DEFAULT_ERROR_CODE,
    message: item.message ?? 'Invalid request',
    level: 'error' as const,
    description: buildDescription(ctx, {
      instancePath: item.instancePath,
      schemaPath: item.schemaPath,
    }),
  }));
}

function buildBusinessErrorResponse(be: BusinessError, ctx: DescriptionContext): ErrorItem {
  return {
    code: be.code,
    message: be.message ?? DEFAULT_ERROR_MESSAGE,
    level: 'error',
    description: buildDescription(ctx),
  };
}

function buildGenericError(ctx: DescriptionContext): ErrorItem {
  return {
    code: DEFAULT_ERROR_CODE,
    message: (ctx.err.message as string | undefined) ?? DEFAULT_ERROR_MESSAGE,
    level: 'error',
    description: buildDescription(ctx),
  };
}

// ─── Main normaliser ──────────────────────────────────────────────────────

interface NormaliseInput {
  req: FastifyRequest;
  statusCode: number;
  err: Record<string, unknown>;
  upstream?: unknown;
}

/**
 * Convierte cualquier error lanzado en la respuesta estándar { errors: [] }.
 *
 * REGLA DE ORO para api2 (sin acceso a BD):
 * Si el upstream trae un código/mensaje real (COBIS o de otra API nuestra),
 * SIEMPRE se propaga tal cual — nunca se reemplaza por un código genérico
 * como UNEXPECTED_ERROR. Solo se usa el catálogo local (ERROR_CATALOG) cuando
 * NO hay ningún cuerpo estructurado que propagar (timeout, red, 5xx sin body).
 *
 * Orden de prioridad:
 *  A) BusinessError de dominio (propio de este servicio)      -> catálogo local (correcto, es error propio)
 *  B) upstream con formato { errors: [...] } (otra API nuestra) -> PROPAGAR code/message reales
 *  C) upstream con formato COBIS { message, error: [...] }      -> PROPAGAR code/message reales
 *  D) Fastify schema validation (400)                            -> catálogo local
 *  E) IntegrationError sin body reconocible (timeout/red)         -> catálogo local (UNEXPECTED_ERROR/UNV)
 *  F) catch-all                                                    -> catálogo local
 */
export function normalizeToErrorsResponse(input: NormaliseInput): ErrorResponse {
  const { req, statusCode, err, upstream } = input;
  const parsed = safeJsonParse(upstream);
  const ctx: DescriptionContext = { req, statusCode, err, upstream: parsed };

  // Caso A - BusinessError de dominio propio de api2
  if (err instanceof BusinessError) {
    return { errors: [buildBusinessErrorResponse(err, ctx)] };
  }

  // Caso B - upstream ya normalizado por otra API nuestra { errors: [...] }
  // IMPORTANTE: se revisa ANTES que "sin body reconocible" para no perder
  // el código real que viene de más abajo en la cadena.
  if (isNormalizedUpstream(parsed)) {
    return { errors: buildNormalizedErrors(parsed, ctx) };
  }

  // Caso C - upstream formato COBIS crudo { message, error: [...] }
  if (isCobisUpstream(parsed)) {
    return { errors: buildCobisErrors(parsed, ctx) };
  }

  // Caso D - Fastify schema validation
  const validation = err.validation as Array<unknown> | undefined;
  if (statusCode === 400 && Array.isArray(validation)) {
    const items = validation.filter(
      (v): v is { message?: string; instancePath?: string; schemaPath?: string } =>
        typeof v === 'object' && v !== null,
    );
    return { errors: buildValidationErrors(items, ctx) };
  }

  // Caso E - IntegrationError sin body estructurado (timeout, red, etc.)
  if (err instanceof IntegrationError) {
    return { errors: [buildIntegrationErrorResponse(err, ctx)] };
  }

  // Caso F - catch-all
  return { errors: [buildGenericError(ctx)] };
}