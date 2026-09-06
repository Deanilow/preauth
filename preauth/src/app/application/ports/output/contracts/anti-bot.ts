import { Channel } from "app/domain/entities/channel";

export interface AntiBotVerifyRequest {
  channel: Channel;
  captchaToken: string;
  clientIp?: string;
}

export interface AntiBotMetadata {
  provider: 'hcaptcha';
  mode: 'live' | 'bypass';
  hostname?: string;
  challengeTs?: string;
  errorCodes?: string[];
  botScore?: number;
  botScoreReason?: string[];
}

export interface AntiBotVerifyResponse {
  verified: boolean;
  score: number;
  metadata: AntiBotMetadata;
}
