import { singleton } from 'tsyringe';
import { RiskStatePort } from '../../application/ports/output/risk-state.port';
import { VELOCITY_CHECK, VelocityCheck } from '../../domain/entities/velocity-check';
import { ClientConstants } from '../clients/client.constants';

// "Velocity" en memoria: ventana deslizante de 5 min por fingerprint. Simula lo que el
// contrato describe como estado interno del Risk Engine (Redis, sliding window 5 min);
// aca es un Map en memoria del propio proceso — suficiente para una sola instancia.
const VELOCITY_WINDOW_MS = 5 * 60 * 1000;
const VELOCITY_LIMIT = 5; // > 5 requests del mismo fingerprint en 5 min -> "exceeded"

@singleton()
export class RiskStateService implements RiskStatePort {
  private readonly velocityLog = new Map<string, number[]>();
  private readonly knownFingerprints = new Set<string>();
  // Blacklist / reputacion simulada — en produccion vendria de un proveedor de threat intel.
  private readonly denylistedIps = new Set<string>(ClientConstants.denylistedIps);

  checkVelocity(fingerprint: string): VelocityCheck {
    const now = Date.now();
    const timestamps = (this.velocityLog.get(fingerprint) ?? []).filter(
      (t) => now - t < VELOCITY_WINDOW_MS,
    );
    timestamps.push(now);
    this.velocityLog.set(fingerprint, timestamps);

    if (timestamps.length > VELOCITY_LIMIT) return VELOCITY_CHECK.EXCEEDED;
    if (timestamps.length > Math.floor(VELOCITY_LIMIT * 0.6)) return VELOCITY_CHECK.WARNING;
    return VELOCITY_CHECK.OK;
  }

  isFingerprintKnown(fingerprint: string): boolean {
    return this.knownFingerprints.has(fingerprint);
  }

  markFingerprintKnown(fingerprint: string): void {
    this.knownFingerprints.add(fingerprint);
  }

  isIpDenylisted(clientIp: string): boolean {
    return this.denylistedIps.has(clientIp);
  }
}
