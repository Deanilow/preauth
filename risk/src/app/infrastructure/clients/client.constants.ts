export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
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

  static get hcaptchaVerifyUrl(): string {
    return this.getEnv('HCAPTCHA_VERIFY_URL') || 'https://api.hcaptcha.com/siteverify';
  }

}

export const normalizeAuthorization = (value: string): string => {
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
};