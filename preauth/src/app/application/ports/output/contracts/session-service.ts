import { Channel } from "app/domain/entities/channel";

export interface CreateSessionRequest {
  flowType: 'onboarding' | 'appclient' | 'otp_only' | string;
  channel: Channel;
  clientIp: string;
  fingerprint: string;
  /** Datos propios del flujo (se persisten en la sesión). */
  context?: Record<string, unknown>;
  correlationId: string;
}

export interface CreateSessionResponse {
  sessionHandle: string;
  expiresIn: number;
}
