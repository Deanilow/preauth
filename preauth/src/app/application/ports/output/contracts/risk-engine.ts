import { Channel } from 'app/domain/entities/channel';
import { AntiBotMetadata } from './anti-bot';

export type RiskDecision = 'allow' | 'challenge' | 'deny';

export interface RiskEvaluateRequest {
  clientIp: string;
  fingerprint: string;
  userAgent: string;
  channel: Channel;
  antiBotScore: number;
  antiBotMetadata?: AntiBotMetadata;
  correlationId: string;
  forceDecision?: RiskDecision;
}

export interface RiskEvaluateResponse {
  score: number;
  decision: RiskDecision;
}
