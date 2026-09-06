import { singleton } from 'tsyringe';
import Redis from 'ioredis';
import { SessionStatePort } from '../../application/ports/output/session-state.port';
import { SessionRecord } from '../../domain/entities/session-state';
import { ClientConstants } from '../clients/client.constants';
import { logger } from 'app/infrastructure/logger';

const FLOW_KEY_PREFIX = 'flow:';
const SUB_KEY_PREFIX = 'sub:';

/**
 * Adaptador real contra Redis para el estado de sesión (`flow:{sessionHandle}`)
 * y su índice secundario por `sub` (`sub:{userSub}` -> sessionHandle).
 *
 * Redis maneja el TTL nativamente (`SET ... EX <ttlSeconds>`): al expirar,
 * la clave desaparece sola, sin necesidad de limpieza manual.
 */
@singleton()
export class SessionStateService implements SessionStatePort {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(ClientConstants.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      logger.error({ err: err.message }, '[SessionState] Redis connection error');
    });
  }

  async save(sessionHandle: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    await this.client.set(FLOW_KEY_PREFIX + sessionHandle, JSON.stringify(record), 'EX', ttlSeconds);
  }

  async find(sessionHandle: string): Promise<SessionRecord | undefined> {
    const raw = await this.client.get(FLOW_KEY_PREFIX + sessionHandle);
    if (!raw) return undefined;
    return JSON.parse(raw) as SessionRecord;
  }

  async delete(sessionHandle: string): Promise<void> {
    await this.client.del(FLOW_KEY_PREFIX + sessionHandle);
  }

  async linkSub(userSub: string, sessionHandle: string, ttlSeconds: number): Promise<void> {
    await this.client.set(SUB_KEY_PREFIX + userSub, sessionHandle, 'EX', ttlSeconds);
  }

  async findByUserSub(userSub: string): Promise<SessionRecord | undefined> {
    const sessionHandle = await this.client.get(SUB_KEY_PREFIX + userSub);
    if (!sessionHandle) return undefined;
    return this.find(sessionHandle);
  }
}
