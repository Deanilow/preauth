export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
  }

  static get serviceApiKey(): string {
    return this.getEnv('SERVICE_API_KEY') || 'dev-service-api-key';
  }

  /** JWKS del Token Service — usado por jose.createRemoteJWKSet para verificar firmas RS256. */
  static get tokenServiceJwksUrl(): string {
    return this.getEnv('TOKEN_SERVICE_JWKS_URL') || `${this.tokenServiceBaseUrl}/jwks`;
  }

  static get tokenServiceBaseUrl(): string {
    return this.getEnv('TOKEN_SERVICE_URL') || 'http://localhost:8023';
  }

  static get expectedSessionTokenAud(): string {
    return this.getEnv('SESSION_TOKEN_AUD') || 'onboarding-service';
  }

  /** KEY VAULT: en producción debe venir del Secret Manager, nunca hardcodeada. */
  static get redisUrl(): string {
    return this.getEnv('REDIS_URL');
  }

  static get sessionServiceBaseUrl(): string {
    return this.getEnv('SESSION_SERVICE_URL') || 'http://localhost:8024';
  }

  static get sessionServiceTimeoutMs(): number {
    return Number(this.getEnv('SESSION_SERVICE_TIMEOUT_MS') || '5000');
  }
}
