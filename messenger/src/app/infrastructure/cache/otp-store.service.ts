import Redis from 'ioredis';
import { singleton } from 'tsyringe';
import { OtpStorePort } from '../../application/ports/output/otp-store.port';
import { OtpRecord } from '../../domain/entities/otp';
import { ClientConstants } from '../clients/client.constants';
import { logger } from 'app/infrastructure/logger';

const OTP_KEY_PREFIX = 'otp:';

/**
 * Almacena el OTP en Redis (`otp:{sessionHandle}`). El TTL lo gestiona Redis
 * nativamente (`SET ... EX <ttlSeconds>`): al expirar, la clave desaparece sola.
 */
@singleton()
export class RedisOtpStoreService implements OtpStorePort {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(ClientConstants.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      logger.error({ err: err.message }, '[OtpStore] Redis connection error');
    });
  }

  async save(sessionHandle: string, record: OtpRecord, ttlSeconds: number): Promise<void> {
    await this.client.set(OTP_KEY_PREFIX + sessionHandle, JSON.stringify(record), 'EX', ttlSeconds);
  }

  async find(sessionHandle: string): Promise<OtpRecord | undefined> {
    const raw = await this.client.get(OTP_KEY_PREFIX + sessionHandle);
    if (!raw) return undefined;
    return JSON.parse(raw) as OtpRecord;
  }

  async delete(sessionHandle: string): Promise<void> {
    await this.client.del(OTP_KEY_PREFIX + sessionHandle);
  }
}
