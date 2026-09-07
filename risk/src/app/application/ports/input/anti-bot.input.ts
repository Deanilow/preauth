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
  // Campos Enterprise/Pro (pueden o no venir según el plan). Se reutilizan en el
  // score del Risk Engine; quedan opcionales para no romper consumidores actuales.
  rawBotScore?: number;
  scoreLevel?: string;
  pass?: boolean;
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
