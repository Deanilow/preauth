export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
  }

  static get cobisIntApiTimeoutMs(): number {
    return Number(this.getEnv('COBIS_INT_API_TIMEOUT_MS') || '9000');
  }

  static get transactionalTransfersApiBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_CUSTOMER_LOAN_BASE_URL');
  }

  static get transactionalTransfersApiTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_CUSTOMER_LOAN_TIMEOUT_MS') || '15000');
  }

  static get databaseUrl(): string {
    return this.getEnv('DATABASE_URL');
  }

  static get postgresPoolMax(): number {
    return Number(this.getEnv('DB_POOL_MAX') || '10');
  }

  static get postgresConnectionTimeoutMs(): number {
    return Number(this.getEnv('DB_CONNECTION_TIMEOUT_MS') || '5000');
  }

  static get postgresIdleTimeoutMs(): number {
    return Number(this.getEnv('DB_IDLE_TIMEOUT_MS') || '30000');
  }

  static get operationsEncryptionKey(): string {
    return this.getEnv('OPERATIONS_ENCRYPTION_KEY');
  }

  static get postgresSSL(): boolean {
    return this.getEnv('POSTGRES_SSL') === 'true';
  }


  static get portfolioBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_PORTFOLIO_QUERY_BASE_URL');
  }

  static get portfolioTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_PORTFOLIO_QUERY_TIMEOUT_MS') || '9000');
  }


  static get accountNotificationsBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_ACCOUNT_NOTIFICATIONS_BASE_URL');
  }

  static get accountNotificationsTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_ACCOUNT_NOTIFICATIONS_TIMEOUT_MS') || '9000');
  }


  /**** DIGITAL TOKEN ****/

  static get privateKey(): string {
    return this.getEnv('DIGITAL_TOKEN_PRIVATE_KEY').replace(/\\n/g, '\n');
  }

  static get publicKey(): string {
    return this.getEnv('DIGITAL_TOKEN_PUBLIC_KEY').replace(/\\n/g, '\n');
  }


  /**** PRE-AUTH ORCHESTRATOR ****/

  static get serviceApiKey(): string {
    return this.getEnv('SERVICE_API_KEY') || 'dev-service-api-key';
  }

  static get antiBotBaseUrl(): string {
    return this.getEnv('ANTI_BOT_URL') || 'http://localhost:4006';
  }

  static get antiBotTimeoutMs(): number {
    return Number(this.getEnv('ANTI_BOT_TIMEOUT_MS') || '5000');
  }

  static get riskEngineBaseUrl(): string {
    return this.getEnv('RISK_ENGINE_URL') || 'http://localhost:4001';
  }

  static get riskEngineTimeoutMs(): number {
    return Number(this.getEnv('RISK_ENGINE_TIMEOUT_MS') || '5000');
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
}

export const normalizeAuthorization = (value: string): string => {
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
};