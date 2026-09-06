import Redis from 'ioredis';
import { singleton } from 'tsyringe';
import { ReplayStorePort } from '../../application/ports/output/replay-store.port';
import { ClientConstants } from '../clients/client.constants';
import { logger } from 'app/infrastructure/logger';

/**
 * Anti-replay sobre Redis real (mismo cluster que Session Service). Reemplaza
 * el `TTLStore` en memoria del script de referencia: `SET key value NX EX ttl`
 * devuelve null si la clave ya existía → replay detectado.
 *
 * Claves usadas por el usecase: `ctx:jti:{jti}` (contextToken, single-use) y
 * `req:{sessionHandle}:{requestId}` (sessionToken, anti-replay por request).
 */
@singleton()
export class RedisReplayStoreService implements ReplayStorePort {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(ClientConstants.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      logger.error({ err: err.message }, '[ReplayStore] Redis connection error');
    });
  }

  async consumeOnce(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }
}   
