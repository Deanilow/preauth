export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: {
    json(): Promise<unknown>;
    text(): Promise<string>;
  };
}

export interface PoolConfig {
  connections?: number;
  keepAliveTimeout?: number;
  keepAliveMaxTimeout?: number;
  allowH2?: boolean;
  pipelining?: number;
  connect?: {
    rejectUnauthorized?: boolean;
    requestCert?: boolean;
    secureOptions?: number;
  };
}
