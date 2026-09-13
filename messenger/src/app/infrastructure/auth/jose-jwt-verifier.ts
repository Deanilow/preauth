import { createRemoteJWKSet, jwtVerify } from 'jose';
import { JwtVerifierPort } from '../../application/ports/output/jwt-verifier.port';
import { ClientConstants } from '../clients/client.constants';
import { BusinessError } from 'src/shared/errors/integration.error';

/**
 * Verificación real de JWTs RS256 emitidos por el Token Service, contra su
 * JWKS remoto (`GET /jwks`). `jose` cachea y refresca las claves automáticamente.
 * Nunca decodifica sin verificar firma.
 */
export class JoseJwtVerifier implements JwtVerifierPort {
  private readonly jwks = createRemoteJWKSet(new URL(ClientConstants.tokenServiceJwksUrl));

  async verify<T extends Record<string, unknown>>(token: string, expectedAud: string): Promise<T> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, { audience: expectedAud });
      return payload as unknown as T;
    } catch (err) {
      throw new BusinessError('INVALID_TOKEN', (err as Error).message);
    }
  }
}
