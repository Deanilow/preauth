import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import { RiskInputPort, EvaluateRiskRequest, EvaluateRiskResponse, IpReputation } from '../ports/input/risk.input';
import { RiskStatePort } from '../ports/output/risk-state.port';
import { RISK_DECISION, RiskDecision } from '../../domain/entities/risk-decision';
import { VELOCITY_CHECK, VelocityCheck } from '../../domain/entities/velocity-check';
import { AntiBotMetadata } from '../ports/input/anti-bot.input';
import { logger } from 'app/infrastructure/logger';

/**
 * Único caso de uso de negocio del Risk Engine: combina la señal anti-bot (hCaptcha,
 * preparado para Enterprise/Pro), reputación de IP, velocity por IP, historial por
 * fingerprint y metadata de dispositivo nativo en un score 0-100, y lo traduce a una
 * decisión (allow / challenge / deny) según los rangos.
 *
 * El `fingerprint` SÍ puntúa aquí (contrato): derivamos `fingerprintKnown`, `newDevice`,
 * `travelAnomaly` y `userAgentConsistent` desde el historial interno.
 */
@injectable()
export class RiskUseCase implements RiskInputPort {
  constructor(
    @inject(DI_TOKENS.RiskStatePort)
    private readonly riskState: RiskStatePort,
  ) { }

  async evaluate(req: EvaluateRiskRequest): Promise<EvaluateRiskResponse> {
    const velocityCheck = this.riskState.checkVelocity(req.clientIp);
    const fingerprintKnown = this.riskState.isFingerprintKnown(req.fingerprint);
    const userAgentConsistent = this.riskState.isUserAgentConsistent(req.fingerprint, req.userAgent);
    const travelAnomaly = this.riskState.isTravelAnomaly(req.fingerprint, req.clientIp);
    // Nota: el flag `newDevice` es exactamente `!fingerprintKnown` ANTES de registrar.
    const newDevice = !fingerprintKnown;

    const ipReputation = this.riskState.isIpDenylisted(req.clientIp) ? 'blacklisted' : 'clean';

    const { score, breakdown } = this.computeScore(req, {
      ipReputation,
      velocityCheck,
      fingerprintKnown,
      userAgentConsistent,
      travelAnomaly,
      newDevice,
    });

    // Registrar DESPUÉS de leer el historial (conserva el flag `newDevice` real).
    this.riskState.recordFingerprint(req.fingerprint, req.userAgent, req.clientIp, req.deviceMetadata);

    const decision = this.resolveDecision(score, req.forceDecision);

    // LOG DEBUG: qué envió el cliente nativo / web para validar fingerprint + metadata.
    console.log(
      '[RiskEngine] recibido ->',
      JSON.stringify({
        fingerprint: req.fingerprint,
        fingerprintLen: req.fingerprint?.length,
        userAgent: req.userAgent,
        clientIp: req.clientIp,
        deviceMetadata: req.deviceMetadata,
        antiBotScore: req.antiBotScore,
      }),
    );

    logger.info(
      { correlationId: req.correlationId, score, decision, breakdown, ipReputation, fingerprintKnown, newDevice, travelAnomaly, userAgentConsistent },
      '[RiskEngine] risk evaluated',
    );

    return {
      score,
      decision,
      signals: {
        ipReputation,
        fingerprintKnown,
        userAgentConsistent,
        antiBotScore: req.antiBotScore,
        velocityCheck,
        newDevice,
        travelAnomaly,
        antiBotMetadata: req.antiBotMetadata,
        deviceMetadata: req.deviceMetadata,
        breakdown,
      },
    };
  }

  /**
   * Suma de señales → score 0-100 (mayor = más riesgo). Los pesos están pensados para
   * que hCaptcha Enterprise/Pro y la metadata de dispositivo nativo tengan peso real.
   */
  private computeScore(
    req: EvaluateRiskRequest,
    ctx: {
      ipReputation: IpReputation;
      velocityCheck: VelocityCheck;
      fingerprintKnown: boolean;
      userAgentConsistent: boolean;
      travelAnomaly: boolean;
      newDevice: boolean;
    },
  ): { score: number; breakdown: Record<string, number> } {
    const metadata = req.antiBotMetadata;

    const base = Math.round((1 - req.antiBotScore) * 60);
    const ipPenalty = ctx.ipReputation === 'blacklisted' ? 40 : ctx.ipReputation === 'suspicious' ? 20 : 0;
    const velocityPenalty =
      ctx.velocityCheck === VELOCITY_CHECK.EXCEEDED ? 25 : ctx.velocityCheck === VELOCITY_CHECK.WARNING ? 10 : 0;
    const devicePenalty = this.deviceIntegrityPenalty(req.deviceMetadata);
    const travelPenalty = ctx.travelAnomaly ? 15 : 0;
    const uaPenalty = ctx.userAgentConsistent ? 0 : 10;

    // Señales específicas del proveedor anti-bot (hCaptcha). Extensibles a Pro/Enterprise.
    const botScorePenalty = this.botScorePenalty(metadata);
    const reasonPenalty = this.botReasonPenalty(metadata);
    const errorClearPenalty = this.errorCodesPenalty(metadata);
    const bypassPenalty = metadata?.mode === 'bypass' ? 15 : 0;

    const total =
      base +
      ipPenalty +
      velocityPenalty +
      devicePenalty +
      travelPenalty +
      uaPenalty +
      botScorePenalty +
      reasonPenalty +
      errorClearPenalty +
      bypassPenalty;
    const score = Math.min(100, Math.max(0, total));

    return {
      score,
      breakdown: {
        base,
        ipPenalty,
        velocityPenalty,
        devicePenalty,
        travelPenalty,
        uaPenalty,
        botScorePenalty,
        reasonPenalty,
        errorClearPenalty,
        bypassPenalty,
      },
    };
  }

  /** Integridad de dispositivo nativo (Play Integrity / DeviceCheck). */
  private deviceIntegrityPenalty(deviceMetadata?: EvaluateRiskRequest['deviceMetadata']): number {
    if (!deviceMetadata) return 0;
    // Sin provider o veredicto no confiable → sospechoso.
    const verdict = deviceMetadata.verdict ?? 'unknown';
    if (deviceMetadata.isRooted) return 30;
    if (deviceMetadata.isEmulator && verdict !== 'MEETS_STRONG_INTEGRITY') return 25;
    switch (verdict) {
      case 'MEETS_STRONG_INTEGRITY':
      case 'MEETS_DEVICE_INTEGRITY':
      case 'pass':
        return 0;
      case 'MEETS_BASIC_INTEGRITY':
        return 10;
      case 'fail':
        return 40;
      default:
        // 'unknown' / sin veredicto → leve presunción en contra (no es fail abierto).
        return 15;
    }
  }

  /** hCaptcha `botScore` (0-1): score alto del proveedor = comportamiento robótico → más riesgo. */
  private botScorePenalty(metadata?: AntiBotMetadata): number {
    const botScore = metadata?.botScore ?? metadata?.rawBotScore;
    if (botScore === undefined) return 0;
    if (botScore >= 0.7) return 35;
    if (botScore >= 0.5) return 20;
    if (botScore >= 0.3) return 10;
    return 0;
  }

  /** hCaptcha `botScoreReason`/`score_reason` (Enterprise/Pro): razones concretas de sospecha. */
  private botReasonPenalty(metadata?: AntiBotMetadata): number {
    const reasons = metadata?.botScoreReason ?? [];
    if (!reasons.length) return 0;
    // Más razones listadas = señal más fuerte.
    return Math.min(25, reasons.length * 5);
  }

  /** `errorCodes` presentes aunque el captcha declare success → validación anómala. */
  private errorCodesPenalty(metadata?: AntiBotMetadata): number {
    return (metadata?.errorCodes?.length ?? 0) > 0 ? 10 : 0;
  }

  private resolveDecision(score: number, forceDecision?: RiskDecision): RiskDecision {
    if (forceDecision) return forceDecision;
    if (score <= 24) return RISK_DECISION.ALLOW;
    if (score <= 64) return RISK_DECISION.CHALLENGE;
    return RISK_DECISION.DENY;
  }
}
