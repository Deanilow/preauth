/**
 * Registro de OTP almacenado en Redis (`otp:{sessionHandle}`).
 * El código se genera en messenger y se valida aquí; nunca se devuelve por HTTP.
 */
export interface OtpRecord {
  sessionHandle: string;
  /** Código OTP de 6 dígitos. */
  code: string;
  /** ISO-8601 de expiración. */
  expiresAt: string;
  /** Cantidad de intentos de verificación fallidos. */
  attempts: number;
}

export const OTP_MAX_ATTEMPTS = 3;
