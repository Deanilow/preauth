import { PoolConfig } from "./http-client.types";

export class HttpClientConfig {
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'local';
  }

  static getDefaultTimeout(): number {
    return Number(process.env.HTTP_TIMEOUT_MS) || 15_000;
  }

  static getDefaultPoolConfig(): PoolConfig {
    const base = {
      connections: 10,
      keepAliveTimeout: 10_000,
      keepAliveMaxTimeout: 30_000,
      pipelining: 1,
    };

    if (!HttpClientConfig.isDevelopment()) return base;

    return {
      ...base,
      connect: {
        rejectUnauthorized: false,
        requestCert: false,
        secureOptions: 0,
      },
    };
  }
}