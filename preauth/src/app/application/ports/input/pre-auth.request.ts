import { Channel } from '../../../domain/entities/channel';

/**
 * Request genérico de context-init.
 * - `flowType` + `channel`: campos comunes.
 * - `context`: datos propios del flujo (ej. fingerprint/captchaToken para appclient,
 *   deviceUuid para otp_only). Se validan y se persisten según el flujo.
 */
export interface ContextInitRequest {
  flowType: string;
  channel: Channel;
  context: Record<string, unknown>;
  clientIp: string;
  userAgent: string;
  correlationId: string;
}
