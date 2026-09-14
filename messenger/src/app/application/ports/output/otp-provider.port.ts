/**
 * Puerto hacia el proveedor de OTP ("otro servicio"): genera y valida el código
 * del celular. La generación/validación real es externa; este puerto abstrae esa
 * integración. El código NO se persiste en este servicio.
 */
export interface OtpProviderPort {
  generate(sessionHandle: string): Promise<void>;
  verify(sessionHandle: string, otpCode: string): Promise<boolean>;
}
