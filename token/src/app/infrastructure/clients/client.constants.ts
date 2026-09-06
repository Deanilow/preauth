export class ClientConstants {
  private static getEnv(name: string): string {
    return process.env[name] ?? '';
  }

  static get serviceApiKey(): string {
    return this.getEnv('SERVICE_API_KEY');
  }
  static get tokenPrivateKeyB64(): string {
    return this.getEnv('TOKEN_PRIVATE_KEY_B64');
  }

  static get tokenPublicKeyB64(): string {
    return this.getEnv('TOKEN_PUBLIC_KEY_B64');
  }

  static get tokenKid(): string {
    return this.getEnv('TOKEN_KID');
  }

}

export const normalizeAuthorization = (value: string): string => {
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
};