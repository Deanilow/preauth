import { Channel } from "app/domain/entities/channel";

export interface ContextTokenRequest {
  channel: Channel;
  fingerprint: string;
  clientIp: string;
  correlationId: string;
}

export interface ContextTokenResponse {
  token: string;
  jti: string;
  expiresIn: number;
}
