export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
  }

  /**** ONBOARDING ORCHESTRATOR ****/

  static get serviceApiKey(): string {
    return this.getEnv('SERVICE_API_KEY') || 'dev-service-api-key';
  }

  static get tokenServiceBaseUrl(): string {
    return this.getEnv('TOKEN_SERVICE_URL') || 'http://localhost:4002';
  }

  static get tokenServiceTimeoutMs(): number {
    return Number(this.getEnv('TOKEN_SERVICE_TIMEOUT_MS') || '5000');
  }

  static get sessionServiceBaseUrl(): string {
    return this.getEnv('SESSION_SERVICE_URL') || 'http://localhost:4003';
  }

  static get sessionServiceTimeoutMs(): number {
    return Number(this.getEnv('SESSION_SERVICE_TIMEOUT_MS') || '5000');
  }

  static get deviceEnrollmentBaseUrl(): string {
    return this.getEnv('DEVICE_ENROLLMENT_URL') || 'http://localhost:4007';
  }

  static get deviceEnrollmentTimeoutMs(): number {
    return Number(this.getEnv('DEVICE_ENROLLMENT_TIMEOUT_MS') || '7000');
  }

  /** JWKS del Token Service — usado por jose.createRemoteJWKSet para verificar firmas RS256. */
  static get tokenServiceJwksUrl(): string {
    return this.getEnv('TOKEN_SERVICE_JWKS_URL') || `${this.tokenServiceBaseUrl}/jwks`;
  }

  static get expectedContextTokenAud(): string {
    return this.getEnv('CONTEXT_TOKEN_AUD') || 'preauth-api';
  }

  static get expectedSessionTokenAud(): string {
    return this.getEnv('SESSION_TOKEN_AUD') || 'onboarding-service';
  }

  /** KEY VAULT: en producción debe venir del Secret Manager, nunca hardcodeada. */
  static get redisUrl(): string {
    return this.getEnv('REDIS_URL');
  }

  static get contextTokenReplayTtlSeconds(): number {
    return Number(this.getEnv('CONTEXT_TOKEN_REPLAY_TTL_SECONDS') || '120');
  }

  static get requestIdempotencyTtlSeconds(): number {
    return Number(this.getEnv('REQUEST_IDEMPOTENCY_TTL_SECONDS') || '30');
  }
}
