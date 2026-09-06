/**
 * General-purpose utilities shared across the application.
 * Previously these helpers were inlined (isObject, toQueryString, etc.)
 * inside specific files. Centralised here so any module can reuse them.
 */


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

/**
 * Formats a Date into a human-readable spanish string with 12h time.
 *
 * @example
 *   formatDate(new Date('2026-07-03T16:05:00'))
 *   // -> '3 de julio de 2026 - 04:05PM'
 */
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

export const CURRENCY_DISPLAY: Record<string, string> = { PEN: 'soles', USD: 'dólares' };

type MapFn<S, T> = (source: S) => T;

/**
 * Wraps and returns a mapper function preserving generic source/target types.
 * Useful to centralise mapper creation and keep type inference.
 *
 * @example
 *   const toUser = createMapper((raw: { id: string }) => ({ userId: raw.id }));
 *   // toUser({ id: '123' }) -> { userId: '123' }
 */
export function createMapper<S, T>(mapFn: MapFn<S, T>): MapFn<S, T> {
  return mapFn;
}
const CURRENCY_SYMBOL: Record<string, string> = { PEN: 'S/' };

/**
 * Converts an ISO currency code into a friendly display label.
 * Returns the same code when no mapping exists.
 *
 * @example
 *   currencyDisplay('PEN') // -> 'soles'
 *   currencyDisplay('USD') // -> 'dólares'
 *   currencyDisplay('EUR') // -> 'EUR'
 */
export function currencyDisplay(code: string): string {
  return CURRENCY_DISPLAY[code?.toUpperCase()] ?? code;
}

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];


/**
 * Resolves the symbol for a currency code.
 * Returns the same code when no symbol mapping exists.
 *
 * @example
 *   currencySymbol('PEN') // -> 'S/'
 *   currencySymbol('USD') // -> 'USD'
 */
export function currencySymbol(code: string) { return CURRENCY_SYMBOL[code?.toUpperCase()] ?? code; }

/**
 * Formats an ISO date (YYYY-MM-DD) to a long spanish date.
 * If the value cannot be parsed, it returns the original input.
 *
 * @example
 *   formatDateEs('2026-07-03') // -> '3 de Julio del 2026'
 *   formatDateEs('invalid')    // -> 'invalid'
 */
export function formatDateEs(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MONTHS_ES[m - 1]} del ${y}`;
}

/**
 * Splits a raw subproduct description into type + normalized description.
 * Rule:
 * - First token => type (Title Case)
 * - Remaining tokens => description (Title Case)
 * - If the first token in description is "de", it is removed
 *
 * @example
 *   parseSubproduct('AHORRO DE SUELDO')
 *   // -> { type: 'Ahorro', description: 'Sueldo' }
 *
 *   parseSubproduct('CUENTA CORRIENTE')
 *   // -> { type: 'Cuenta', description: 'Corriente' }
 */
export function parseSubproduct(raw: string | null | undefined): { type: string; description: string } {
  const parts = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { type: '', description: '' };
  const toTitle = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const [first, ...rest] = parts;
  return {
    type: toTitle(first),
    description: rest.filter((w, i) => !(i === 0 && w.toLowerCase() === 'de')).map(toTitle).join(' '),
  };
}


/**
 * Formatea un string ISO 8601 (ej: "2026-07-14T11:32:30-05:00") a un formato
 * relativo legible en español, usando la zona horaria America/Lima (UTC-5).
 *
 * Reglas:
 * - Si es hoy       → "Hoy - 11:32 AM"
 * - Si es ayer      → "Ayer - 03:45 PM"
 * - Si es otro día  → "Lunes - 11:32 AM"
 *
 * @param isoString - Fecha en formato ISO 8601 con offset (ej: "2026-07-14T11:32:30-05:00")
 * @returns String formateado según las reglas descritas
 */
export function formatRelativeDate(isoString: string): string {
  if (!isoString) return '';
  // Zona horaria de Perú (UTC-5) — Bogotá también es UTC-5
  const timeZone = 'America/Lima';

  // Parsear la fecha del string ISO
  const inputDate = new Date(isoString);

  // Obtener la fecha "hoy" en la zona horaria de Lima/Bogotá
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone }); // formato YYYY-MM-DD
  const inputDayStr = inputDate.toLocaleDateString('en-CA', { timeZone }); // formato YYYY-MM-DD

  // Calcular "ayer" en la misma zona horaria
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone });

  // Formatear la hora en formato 12h con AM/PM
  const timeFormatted = formatTime(inputDate, timeZone);

  // Determinar el prefijo según la fecha
  if (inputDayStr === todayStr) {
    // Es hoy
    return `Hoy - ${timeFormatted}`;
  }

  if (inputDayStr === yesterdayStr) {
    // Es ayer
    return `Ayer - ${timeFormatted}`;
  }

  // Es otro día → mostrar nombre del día en español (capitalizado)
  const dayName = getDayName(inputDate, timeZone);
  return `${dayName} - ${timeFormatted}`;
}

/**
 * Obtiene la hora formateada en 12h con AM/PM.
 * Ejemplo: "11:32 AM", "03:45 PM"
 *
 * @param date - Objeto Date a formatear
 * @param timeZone - Zona horaria para la conversión
 * @returns Hora formateada (ej: "11:32 AM")
 */
function formatTime(date: Date, timeZone: string): string {
  // Obtener horas y minutos en la zona horaria especificada
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '12';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const period = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() ?? 'AM';

  return `${hour}:${minute} ${period}`;
}

/**
 * Obtiene el nombre del día en español, capitalizado.
 * Ejemplo: "Lunes", "Martes", "Miércoles"
 *
 * @param date - Objeto Date
 * @param timeZone - Zona horaria para determinar el día correcto
 * @returns Nombre del día capitalizado (ej: "Miércoles")
 */
function getDayName(date: Date, timeZone: string): string {
  const dayName = new Intl.DateTimeFormat('es-PE', {
    timeZone,
    weekday: 'long',
  }).format(date);

  // Capitalizar primera letra
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

/**
 * Returns the first and last day of a period (MM-YYYY) in DD-MM-YYYY format.
 *
 * @example
 *   getPeriodDateTimes('07-2026')
 *   // → ['01-07-2026', '31-07-2026']
 */
export function getPeriodDateTimes(period: string): [string, string] {
  const [month, year] = period.split('-').map(Number);

  const formattedMonth = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();

  const firstDateTime = `01-${formattedMonth}-${year}`;
  const lastDateTime = `${String(lastDay).padStart(2, '0')}-${formattedMonth}-${year}`;

  return [firstDateTime, lastDateTime];
}
/**
 * Formats a date as:
 * dd/MM/yyyy - hh:mm AM/PM
 *
 * If no date is provided, the current date is used.
 */
export function formatDateTime(date?: Date): string {
  const currentDate = date ?? new Date();

  const day = String(currentDate.getDate()).padStart(2, '0');
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const year = currentDate.getFullYear();

  const hours24 = currentDate.getHours();
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${day} /${month}/${year} - ${String(hours12).padStart(2, '0')}:${minutes} ${period} `;
}


