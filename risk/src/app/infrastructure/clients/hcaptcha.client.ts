import * as https from 'https';
import { injectable } from 'tsyringe';
import { logger } from '../logger';
import { ClientConstants } from './client.constants';
import { IntegrationError } from 'src/shared/errors/integration.error';

/**
 * Respuesta del endpoint `/siteverify` de hCaptcha.
 * Mapea los campos estándar, los campos Enterprise (`score`, `score_reason`)
 * y preserva `rawResponse` para inspección total en logs y Risk Engine.
 */
export interface HCaptchaSiteVerifyResult {
  success: boolean;
  challengeTs?: string;
  hostname?: string;
  errorCodes?: string[];
  botScore?: number;
  botScoreReason?: string[];
  rawResponse?: Record<string, unknown>; // Mantiene la respuesta JSON íntegra recibida
}

/**
 * Cliente del endpoint real `POST https://api.hcaptcha.com/siteverify`.
 * Requiere `application/x-www-form-urlencoded` (no JSON).
 */
@injectable()
export class HCaptchaClient {
  async siteVerify(token: string, remoteIp?: string): Promise<HCaptchaSiteVerifyResult> {
    const endpoint = ClientConstants.hcaptchaVerifyUrl;
    const params = new URLSearchParams({ secret: ClientConstants.hcaptchaSecret, response: token });
    if (remoteIp) params.set('remoteip', remoteIp);
    if (ClientConstants.hcaptchaSiteKey) params.set('sitekey', ClientConstants.hcaptchaSiteKey);

    const body = params.toString();
    const timeoutMs = ClientConstants.hcaptchaTimeoutMs;

    logger.info({ client: 'HCaptchaService', hasRemoteIp: !!remoteIp }, '[HCaptchaClient] START siteverify');

    const raw = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new IntegrationError('hCaptcha siteverify timeout', 504, undefined, endpoint, undefined, undefined, 'HCaptchaService'));
      });
      req.on('error', (err) => {
        reject(new IntegrationError(err.message, 500, undefined, endpoint, undefined, err, 'HCaptchaService'));
      });
      req.write(body);
      req.end();
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new IntegrationError(`Invalid JSON from hCaptcha: ${raw.substring(0, 200)}`, 502, raw, endpoint, undefined, undefined, 'HCaptchaService');
    }

    // LOG DE INSPECCIÓN: Imprime el JSON completo recibido de hCaptcha
    logger.info(
      {
        client: 'HCaptchaService',
        success: parsed.success,
        rawPayload: parsed, // <-- Aquí verás absolutamente todos los campos que devuelva hCaptcha en tu ambiente
      },
      '[HCaptchaClient] OK siteverify raw payload',
    );

    // Mapeo flexible de razones (compatibilidad entre score_reason, score_reasons y reasons)
    const scoreReason = (parsed.score_reason || parsed.score_reasons || parsed.reasons) as string[] | undefined;

    return {
      success: !!parsed.success,
      challengeTs: parsed.challenge_ts as string | undefined,
      hostname: parsed.hostname as string | undefined,
      errorCodes: parsed['error-codes'] as string[] | undefined,
      botScore: (parsed.score ?? parsed.bot_score) as number | undefined,
      botScoreReason: scoreReason,
      rawResponse: parsed,
    };
  }
}