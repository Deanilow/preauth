import { Channel } from '../../../domain/entities/channel';

export interface VerifyAntiBotRequest {
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

export interface VerifyAntiBotResponse {
  verified: boolean;
  score: number;
  provider: string;
  metadata: AntiBotMetadata;
}

export interface AntiBotInputPort {
  verify(req: VerifyAntiBotRequest): Promise<VerifyAntiBotResponse>;
}
