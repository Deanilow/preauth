import { Channel } from '../../../domain/entities/channel';
import { RiskDecision } from '../../../application/ports/output/contracts/risk-engine';


export interface ContextInitBodyDto {
  channel: Channel;
  fingerprint: string;
  captchaToken: string;
}

export interface ContextInitResponseDto {
  contextToken: string;
  sessionHandle: string;
  expiresIn: number;
}
