import { Channel } from '../../../domain/entities/channel';
import { RiskDecision } from '../../../application/ports/output/contracts/risk-engine';


export interface ContextInitBodyDto {
  flowType: string;
  channel: Channel;
  context: Record<string, unknown>;
}

export interface ContextInitResponseDto {
  contextToken: string;
  sessionHandle: string;
  expiresIn: number;
}
