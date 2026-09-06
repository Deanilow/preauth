import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { DigitalTokenSignerOutputPort, JwksResult } from '../../application/ports/output/digital-token.port';
import { ClientConstants } from '../clients/client.constants';

/**
 * KEY VAULT: en produccion, privateKey/publicKey deben resolverse desde
 * KMS/HSM (ej. Azure Key Vault, AWS KMS) y la firma debe delegarse al SDK
 * del proveedor — la clave privada nunca debe residir en memoria del proceso.
 * Por ahora se leen desde variables de entorno (PEM en base64) como placeholder
 * de desarrollo.
 */
export class JwtSigner implements DigitalTokenSignerOutputPort {
  private get privateKey(): string {
    return Buffer.from(ClientConstants.tokenPrivateKeyB64, 'base64').toString('utf8');
  }

  private get publicKey(): string {
    return Buffer.from(ClientConstants.tokenPublicKeyB64, 'base64').toString('utf8');
  }

  private get kid(): string {
    return ClientConstants.tokenKid;
  }

  async sign(payload: Record<string, unknown>, expiresInSeconds: number): Promise<string> {
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: expiresInSeconds,
      keyid: this.kid,
    });
  }

  getJwks(): JwksResult {
    const { n, e } = createPublicKey(this.publicKey).export({ format: 'jwk' }) as { n: string; e: string };
    return {
      keys: [
        { kty: 'RSA', use: 'sig', alg: 'RS256', kid: this.kid, n, e },
      ],
    };
  }
}