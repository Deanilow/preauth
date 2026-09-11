import { Channel } from "app/domain/entities/channel";

export interface CreateSessionRequest {
  flowType: 'onboarding' | 'appclient';
  channel: Channel;
  clientIp: string;
  fingerprint: string;
  correlationId: string;
}

export interface CreateSessionResponse {
  sessionHandle: string;
  expiresIn: number;
}
