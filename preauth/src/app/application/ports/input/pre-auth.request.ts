import { Channel } from '../../../domain/entities/channel';

export interface ContextInitRequest {
  channel: Channel;
  fingerprint: string;
  captchaToken: string;
  clientIp: string;
  userAgent: string;
  correlationId: string;
}
