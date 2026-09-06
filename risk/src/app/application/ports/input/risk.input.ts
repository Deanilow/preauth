import { Channel } from '../../../domain/entities/channel';
import { RiskDecision } from '../../../domain/entities/risk-decision';
import { VelocityCheck } from '../../../domain/entities/velocity-check';
import { AntiBotMetadata } from './anti-bot.input';

export interface EvaluateRiskRequest {
  clientIp: string;
  fingerprint: string;
  userAgent: string;
  channel: Channel;
  antiBotScore: number;
  antiBotMetadata?: AntiBotMetadata;
  correlationId: string;
  forceDecision?: RiskDecision;
}

export interface RiskSignals {
  ipReputation: 'clean' | 'blacklisted';
  fingerprintKnown: boolean;
  userAgentConsistent: boolean;
  antiBotScore: number;
  velocityCheck: VelocityCheck;
  newDevice: boolean;
  antiBotMetadata?: AntiBotMetadata;
}

export interface EvaluateRiskResponse {
  score: number;
  decision: RiskDecision;
  signals: RiskSignals;
}

export interface RiskInputPort {
  evaluate(req: EvaluateRiskRequest): Promise<EvaluateRiskResponse>;
}
