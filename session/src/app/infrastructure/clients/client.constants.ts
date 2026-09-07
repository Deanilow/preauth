export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
  }

  static get redisUrl(): string {
    return this.getEnv('REDIS_URL');
  }


  static get serviceApiKey(): string {
    return this.getEnv('SERVICE_API_KEY');
  }

}

export const normalizeAuthorization = (value: string): string => {
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
};