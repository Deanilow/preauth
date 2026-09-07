import { VelocityCheck } from '../../../domain/entities/velocity-check';
import { DeviceMetadata } from '../../../domain/entities/device-metadata';

/**
 * Estado interno del Risk Engine.
 *
 * Indexa historial por `clientIp` (velocity) y por `fingerprint` (para derivar
 * `fingerprintKnown`, `newDevice`, `travelAnomaly`, `userAgentConsistent`).
 */
export interface RiskStatePort {
  /** Ventana deslizante de 5 min por clientIp. */
  checkVelocity(clientIp: string): VelocityCheck;
  isIpDenylisted(clientIp: string): boolean;

  /** ¿El fingerprint ya fue visto antes? */
  isFingerprintKnown(fingerprint: string): boolean;
  /** ¿El userAgent es consistente con el histórico del fingerprint? */
  isUserAgentConsistent(fingerprint: string, userAgent: string): boolean;
  /** ¿La metadata de dispositivo / IP indica viaje/ASN inconsistente? */
  isTravelAnomaly(fingerprint: string, clientIp: string): boolean;
  /**
   * Registra el fingerprint con su contexto (UA, IP, device) y devuelve si era
   * conocido antes de este registro (necesario para calcular `newDevice`).
   */
  recordFingerprint(fingerprint: string, userAgent: string, clientIp: string, deviceMetadata?: DeviceMetadata): boolean;
}
