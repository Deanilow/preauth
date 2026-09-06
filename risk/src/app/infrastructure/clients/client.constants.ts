export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
  }

  static get aesSecretKey(): string {
    return this.getEnv('AES_SECRET_KEY');
  }

  static get documentInformationBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_CUSTOMERS_MANAGEMENT_DIRECTORY_BASE_URL');
  }

  static get documentInformationApiTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_CUSTOMERS_MANAGEMENT_DIRECTORY_TIMEOUT_MS') || '15000');
  }

  static get accountBalanceTransactionsApiBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_ACCOUNT_BALANCES_TRANSACTIONS_BASE_URL');
  }

  static get accountBalanceTransactionsApiTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_ACCOUNT_BALANCES_TRANSACTIONS_TIMEOUT_MS') || '30000');
  }

  static get messengerApiUrl(): string {
    return this.getEnv('MESSENGER_API_URL');
  }

  static get messengerApiTimeoutMs(): number {
    return Number(this.getEnv('MESSENGER_API_TIMEOUT_MS') || '7000');
  }

  static get cobisIdentifierApiBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_CUSTOMER_LOAN_BASE_URL');
  }

  static get cobisIdentifierApiTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_CUSTOMER_LOAN_TIMEOUT_MS') || '9000');
  }

  static get identityAccessSessionRoleUrl(): string {
    return this.getEnv('APPCLI_API_BACK_CUSTOMER_ACCESS_IDENTITY_BASE_URL');
  }

  static get identityAccessApiTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_CUSTOMER_ACCESS_IDENTITY_TIMEOUT_MS') || '9000');
  }

  static get verificationEmailSender(): string {
    return this.getEnv('VERIFICATION_EMAIL_SENDER');
  }

  static get customerAccountPositionApiBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_CUSTOMER_ACCOUNT_POSITION_BASE_URL');
  }

  static get customerAccountPositionApiTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_CUSTOMER_ACCOUNT_POSITION_TIMEOUT_MS') || '9000');
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

  static get postgresSSL(): boolean {
    return this.getEnv('POSTGRES_SSL') === 'true';
  }


  static get portfolioBaseUrl(): string {
    return this.getEnv('APPCLI_API_BACK_PORTFOLIO_QUERY_BASE_URL');
  }

  static get portfolioTimeoutMs(): number {
    return Number(this.getEnv('APPCLI_API_BACK_PORTFOLIO_QUERY_TIMEOUT_MS') || '9000');
  }


  static get serviceApiKey(): string {
    return this.getEnv('SERVICE_API_KEY') || 'dev-service-api-key';
  }

  static get denylistedIps(): string[] {
    const raw = this.getEnv('DENYLISTED_IPS') || '1.2.3.4,6.6.6.6';
    return raw.split(',').map((ip) => ip.trim()).filter(Boolean);
  }

  static get hcaptchaSecret(): string {
    return this.getEnv('HCAPTCHA_SECRET');
  }

  static get hcaptchaSiteKey(): string {
    return this.getEnv('HCAPTCHA_SITEKEY');
  }

  static get hcaptchaTimeoutMs(): number {
    return Number(this.getEnv('HCAPTCHA_TIMEOUT_MS') || '5000');
  }

  // Override solo para tests/mocks locales; en real siempre debe apuntar a hCaptcha.
  static get hcaptchaVerifyUrl(): string {
    return this.getEnv('HCAPTCHA_VERIFY_URL') || 'https://api.hcaptcha.com/siteverify';
  }

}

export const normalizeAuthorization = (value: string): string => {
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
};