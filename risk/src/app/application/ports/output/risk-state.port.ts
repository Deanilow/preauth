import { VelocityCheck } from '../../../domain/entities/velocity-check';

export interface RiskStatePort {
  checkVelocity(fingerprint: string): VelocityCheck;
  isFingerprintKnown(fingerprint: string): boolean;
  markFingerprintKnown(fingerprint: string): void;
  isIpDenylisted(clientIp: string): boolean;
}
