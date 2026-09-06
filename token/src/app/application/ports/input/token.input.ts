import { Channel } from '../../../domain/entities/channel';
import { JwksResult } from '../output/digital-token.port';

export interface EmitContextTokenRequest {
  channel: Channel;
  fingerprint: string;
  clientIp: string;
  correlationId: string;
}

export interface EmitSessionTokenRequest {
  sessionHandle: string;
  channel: Channel;
  clientIp: string;
  correlationId: string;
}

export interface EmitTokenResponse {
  token: string;
  jti: string;
  expiresIn: number;
}

export interface TokenInputPort {
  emitContextToken(req: EmitContextTokenRequest): Promise<EmitTokenResponse>;
  emitSessionToken(req: EmitSessionTokenRequest): Promise<EmitTokenResponse>;
  getJwks(): JwksResult;
}
