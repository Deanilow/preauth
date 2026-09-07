import { singleton } from 'tsyringe';
import { RiskStatePort } from '../../application/ports/output/risk-state.port';
import { VELOCITY_CHECK, VelocityCheck } from '../../domain/entities/velocity-check';
import { DeviceMetadata } from '../../domain/entities/device-metadata';
import { ClientConstants } from '../clients/client.constants';

// "Velocity" en memoria: ventana deslizante de 5 min por clientIp. Simula lo que el
// contrato describe como estado interno del Risk Engine (Redis, sliding window 5 min);
// aca es un Map en memoria del propio proceso — suficiente para una sola instancia.
const VELOCITY_WINDOW_MS = 5 * 60 * 1000;
const VELOCITY_LIMIT = 5; // > 5 requests del mismo IP en 5 min -> "exceeded"

// Historial por fingerprint. En produccion viviria en Redis; aqui en memoria.
interface FingerprintHistory {
  userAgents: Set<string>;
  clientIps: Set<string>;
  deviceProviders: Set<string>;
}

@singleton()
export class RiskStateService implements RiskStatePort {
  private readonly velocityLog = new Map<string, number[]>();
  private readonly fingerprintHistory = new Map<string, FingerprintHistory>();
  // Blacklist / reputacion simulada — en produccion vendria de un proveedor de threat intel.
  private readonly denylistedIps = new Set<string>(ClientConstants.denylistedIps);

  checkVelocity(clientIp: string): VelocityCheck {
    const now = Date.now();
    const timestamps = (this.velocityLog.get(clientIp) ?? []).filter(
      (t) => now - t < VELOCITY_WINDOW_MS,
    );
    timestamps.push(now);
    this.velocityLog.set(clientIp, timestamps);

    if (timestamps.length > VELOCITY_LIMIT) return VELOCITY_CHECK.EXCEEDED;
    if (timestamps.length > Math.floor(VELOCITY_LIMIT * 0.6)) return VELOCITY_CHECK.WARNING;
    return VELOCITY_CHECK.OK;
  }

  isIpDenylisted(clientIp: string): boolean {
    return this.denylistedIps.has(clientIp);
  }

  isFingerprintKnown(fingerprint: string): boolean {
    return this.fingerprintHistory.has(fingerprint);
  }

  isUserAgentConsistent(fingerprint: string, userAgent: string): boolean {
    const history = this.fingerprintHistory.get(fingerprint);
    if (!history || history.userAgents.size === 0) return true;
    return history.userAgents.has(userAgent);
  }

  isTravelAnomaly(fingerprint: string, clientIp: string): boolean {
    const history = this.fingerprintHistory.get(fingerprint);
    if (!history || history.clientIps.size === 0) return false;
    // Anomalía: el MISMO fingerprint ya fue visto desde OTRA IP.
    return !history.clientIps.has(clientIp);
  }

  recordFingerprint(
    fingerprint: string,
    userAgent: string,
    clientIp: string,
    deviceMetadata?: DeviceMetadata,
  ): boolean {
    const wasKnown = this.fingerprintHistory.has(fingerprint);
    const history = this.fingerprintHistory.get(fingerprint) ?? {
      userAgents: new Set<string>(),
      clientIps: new Set<string>(),
      deviceProviders: new Set<string>(),
    };
    history.userAgents.add(userAgent);
    history.clientIps.add(clientIp);
    if (deviceMetadata?.provider) history.deviceProviders.add(deviceMetadata.provider);
    this.fingerprintHistory.set(fingerprint, history);
    return wasKnown;
  }
}

