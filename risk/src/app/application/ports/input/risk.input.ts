import { Channel } from '../../../domain/entities/channel';
import { RiskDecision } from '../../../domain/entities/risk-decision';
import { VelocityCheck } from '../../../domain/entities/velocity-check';
import { DeviceMetadata } from '../../../domain/entities/device-metadata';
import { AntiBotMetadata } from './anti-bot.input';

export type IpReputation = 'clean' | 'suspicious' | 'blacklisted' | 'tor' | 'vpn' | 'proxy';

export interface EvaluateRiskRequest {
  clientIp: string;
  fingerprint: string;
  userAgent: string;
  channel: Channel;
  antiBotScore: number;
  antiBotMetadata?: AntiBotMetadata;
  /** Metadata de dispositivo nativo (Android/iOS). Opcional: enriquece el score. */
  deviceMetadata?: DeviceMetadata;
  correlationId: string;
  forceDecision?: RiskDecision;
}

export interface RiskSignals {
  ipReputation: IpReputation;
  fingerprintKnown: boolean;
  userAgentConsistent: boolean;
  antiBotScore: number;
  velocityCheck: VelocityCheck;
  newDevice: boolean;
  travelAnomaly: boolean;
  antiBotMetadata?: AntiBotMetadata;
  deviceMetadata?: DeviceMetadata;
  breakdown: Record<string, number>;
}

export interface EvaluateRiskResponse {
  score: number;
  decision: RiskDecision;
  signals: RiskSignals;
}

export interface RiskInputPort {
  evaluate(req: EvaluateRiskRequest): Promise<EvaluateRiskResponse>;
}
