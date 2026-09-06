/**
 * General-purpose utilities shared across the application.
 * Previously these helpers were inlined (isObject, toQueryString, etc.)
 * inside specific files. Centralised here so any module can reuse them.
 */

import { BusinessError } from "../../shared/errors/integration.error";

/** Returns true only for plain objects (not arrays, null, or primitives). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Serialises a flat record to a URL query string.
 * Values are URI-encoded — safe for injection in path strings.
 *
 * @example
 *   toQueryString({ customerId: 'abc 123', page: 1 })
 *   // → 'customerId=abc%20123&page=1'
 */
export function toQueryString(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/**
 * Safely attempts to parse a value as JSON.
 * If the input is not a string or is invalid JSON, returns the original value.
 */
export function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Masks sensitive header values before logging.
 * Operates case-insensitively on header names.
 */
export function maskSensitiveHeaders(
  headers: Record<string, string>,
  sensitiveKeys = ['authorization', 'x-api-key'],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) =>
      sensitiveKeys.includes(k.toLowerCase()) ? [k, '***'] : [k, v],
    ),
  );
}

export function maskAccount(n: string): string {
  return n.length <= 4 ? n : `**** **** **** ${n.slice(-4)}`;
}

export function formatDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('es-ES', { month: 'long' });
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'am';
  hours = hours % 12 || 12;
  return `${day} de ${month} de ${year} - ${hours.toString().padStart(2, '0')}:${minutes}${ampm}`;
}

export function validateAmount(amount: string): void {
  if (!amount?.trim()) throw new BusinessError('VALIDATION_ERROR', 'El monto es requerido.');
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) throw new BusinessError('VALIDATION_ERROR', `Monto inválido: '${amount}'`);
  const dec = amount.split('.')[1];
  if (dec && dec.length > 2) throw new BusinessError('VALIDATION_ERROR', 'El monto no puede tener más de 2 decimales.');
}

export const CURRENCY_DISPLAY: Record<string, string> = { PEN: 'soles', USD: 'dólares' };
