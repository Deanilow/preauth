import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import { RiskInputPort, EvaluateRiskRequest, EvaluateRiskResponse } from '../ports/input/risk.input';
import { RiskStatePort } from '../ports/output/risk-state.port';
import { RISK_DECISION, RiskDecision } from '../../domain/entities/risk-decision';
import { VELOCITY_CHECK, VelocityCheck } from '../../domain/entities/velocity-check';
import { CHANNEL } from '../../domain/entities/channel';
import { logger } from 'app/infrastructure/logger';

/**
 * Unico caso de uso de negocio del Risk Engine: combina reputacion de IP, velocity
 * (ventana deslizante 5 min), antiBotScore y canal en un score 0-100, y lo traduce
 * a una decision (allow / challenge / deny) segun los rangos del contrato.
 */
@injectable()
export class RiskUseCase implements RiskInputPort {
  constructor(
    @inject(DI_TOKENS.RiskStatePort)
    private readonly riskState: RiskStatePort,
  ) { }

  async evaluate(req: EvaluateRiskRequest): Promise<EvaluateRiskResponse> {
    const velocityCheck = this.riskState.checkVelocity(req.fingerprint);
    const fingerprintKnown = this.riskState.isFingerprintKnown(req.fingerprint);
    this.riskState.markFingerprintKnown(req.fingerprint);
    const ipReputation = this.riskState.isIpDenylisted(req.clientIp) ? 'blacklisted' : 'clean';
    const userAgentConsistent = true; // simulado: sin base real de UA-por-fingerprint

    const score = this.computeScore(req, { ipReputation, velocityCheck, fingerprintKnown });
    const decision = this.resolveDecision(score, req.forceDecision);

    logger.info({ correlationId: req.correlationId, score, decision }, '[RiskEngine] risk evaluated');

    return {
      score,
      decision,
      signals: {
        ipReputation,
        fingerprintKnown,
        userAgentConsistent,
        antiBotScore: req.antiBotScore,
        velocityCheck,
        newDevice: !fingerprintKnown,
        antiBotMetadata: req.antiBotMetadata,
      },
    };
  }

  private computeScore(
    req: EvaluateRiskRequest,
    ctx: { ipReputation: 'clean' | 'blacklisted'; velocityCheck: VelocityCheck; fingerprintKnown: boolean },
  ): number {
    // 1. Riesgo base derivado del antiBotScore (0.0 = humano [0 pts riesgo], 1.0 = bot [60 pts riesgo])
    let score = Math.round((1 - req.antiBotScore) * 60);

    // 2. Penalizaciones por red y dispositivo
    if (ctx.ipReputation === 'blacklisted') score += 40;
    if (ctx.velocityCheck === VELOCITY_CHECK.EXCEEDED) score += 25;
    else if (ctx.velocityCheck === VELOCITY_CHECK.WARNING) score += 10;
    if (!ctx.fingerprintKnown && req.channel === CHANNEL.APP) score += 5;

    // 3. Alerta adicional solo si hCaptcha trajo error_codes a pesar de dar success
    if (req.antiBotMetadata?.errorCodes?.length) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private resolveDecision(score: number, forceDecision?: RiskDecision): RiskDecision {
    if (forceDecision) return forceDecision;
    if (score <= 24) return RISK_DECISION.ALLOW;
    if (score <= 64) return RISK_DECISION.CHALLENGE;
    return RISK_DECISION.DENY;
  }
}
