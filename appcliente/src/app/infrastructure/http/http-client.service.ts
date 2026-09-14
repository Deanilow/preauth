import { singleton } from "tsyringe";
import { logger } from "../logger";
import { HttpClientConfig } from "./http-client.config";
import { HttpRequestOptions, HttpResponse } from "./http-client.types";
import * as https from 'https';
import * as http from 'http';

@singleton()
export class HttpClientService {
  private readonly agent: https.Agent;

  constructor() {
    const config = HttpClientConfig.getDefaultPoolConfig();
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: config.connections ?? 10,
      ...(config.connect ?? {})
    });

    if (HttpClientConfig.isDevelopment()) {
      logger.warn('[HttpClientService] TLS certificate validation is DISABLED (Development environment)');
    }

    logger.info('[HttpClientService] HTTP Client Service initialized');
  }

  private buildHeaders(bodyString?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      'User-Agent': 'node/https',
    };

    if (bodyString) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    return headers;
  }

  private buildResponse(raw: string, res: http.IncomingMessage, hostname: string): HttpResponse {
    return {
      statusCode: res.statusCode ?? 0,
      headers: res.headers as Record<string, string | string[]>,
      body: {
        json: () => {
          try {
            return Promise.resolve(JSON.parse(raw));
          } catch {
            return Promise.reject(
              new Error(`Invalid JSON response from ${hostname}: ${raw.substring(0, 200)}`)
            );
          }
        },
        text: () => Promise.resolve(raw)
      }
    };
  }

  private collectBody(res: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }

  async request(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
    const timeout = options.timeout ?? HttpClientConfig.getDefaultTimeout();
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyString = options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined;

    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: {
        ...this.buildHeaders(bodyString),
        ...options.headers
      },
      agent: isHttps ? this.agent : undefined,
      timeout,
      servername: urlObj.hostname,
    };

    return new Promise((resolve, reject) => {
      const req = lib.request(reqOptions, async (res) => {
        if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          this.request(res.headers.location, options).then(resolve).catch(reject);
          return;
        }

        const raw = await this.collectBody(res);
        resolve(this.buildResponse(raw, res, urlObj.hostname));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms: ${url}`));
      });

      req.on('error', reject);

      if (bodyString) {
        req.write(bodyString);
      }

      req.end();
    });
  }

  async closeAll(): Promise<void> {
    this.agent.destroy();
    logger.info('[HttpClientService] HTTP agent destroyed');
  }

  getStats(): { agent: string } {
    return { agent: 'native-https' };
  }
}