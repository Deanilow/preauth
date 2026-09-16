import { Channel } from "app/domain/entities/channel";

export interface CreateSessionRequest {
  flowType: 'onboarding' | 'appclient' | 'otp_only' | string;
  channel: Channel;
  clientIp: string;
  /** Datos propios del flujo (incluye el deviceId: fingerprint / deviceUuid). */
  context?: Record<string, unknown>;
  correlationId: string;
}

export interface CreateSessionResponse {
  sessionHandle: string;
  expiresIn: number;
}
