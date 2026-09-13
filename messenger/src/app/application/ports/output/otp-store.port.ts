import { OtpRecord } from '../../../domain/entities/otp';

/**
 * Puerto de almacenamiento del OTP en Redis (`otp:{sessionHandle}`).
 * El TTL lo gestiona Redis nativamente (`SET ... EX <ttl>`).
 */
export interface OtpStorePort {
  save(sessionHandle: string, record: OtpRecord, ttlSeconds: number): Promise<void>;
  find(sessionHandle: string): Promise<OtpRecord | undefined>;
  delete(sessionHandle: string): Promise<void>;
}
