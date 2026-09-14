/**
 * Puerto de verificación de JWTs firmados RS256 emitidos por el Token Service.
 * La implementación real valida contra el JWKS remoto (`GET /jwks`) — nunca
 * decodifica sin verificar firma.
 */
export interface JwtVerifierPort {
  /**
   * Verifica firma, expiración y `aud`. Lanza si el token es inválido/expiró/aud no coincide.
   * @param expectedAud audiencia esperada ('preauth-api' para contextToken, 'onboarding-service' para sessionToken)
   */
  verify<T extends Record<string, unknown>>(token: string, expectedAud: string): Promise<T>;
}
