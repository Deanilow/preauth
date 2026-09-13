/**
 * Puerto de verificación de JWTs firmados RS256 emitidos por el Token Service.
 * La implementación real valida contra el JWKS remoto (`GET /jwks`) — nunca
 * decodifica sin verificar firma.
 */
export interface JwtVerifierPort {
  verify<T extends Record<string, unknown>>(token: string, expectedAud: string): Promise<T>;
}
