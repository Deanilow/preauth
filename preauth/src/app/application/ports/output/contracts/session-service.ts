import { Channel } from "app/domain/entities/channel";

export interface CreateSessionRequest {
  channel: Channel;
  clientIp: string;
  fingerprint: string;
  correlationId: string;
}

export interface CreateSessionResponse {
  sessionHandle: string;
  expiresIn: number;
}
