import { singleton } from 'tsyringe';
import Redis from 'ioredis';
import { SessionStatePort } from '../../application/ports/output/session-state.port';
import { SessionRecord, SessionClientInfo } from '../../domain/entities/session-state';
import { ClientConstants } from '../clients/client.constants';
import { logger } from 'app/infrastructure/logger';

const FLOW_KEY_PREFIX = 'flow:';
const SUB_KEY_PREFIX = 'sub:';

/**
 * Adaptador real contra Redis para el estado de sesión (`flow:{sessionHandle}`)
 * y su índice secundario por `sub` (`sub:{userSub}` -> SessionClientInfo).
 *
 * El índice `sub:{userSub}` guarda la proyección del cliente (sessionHandle,
 * userSub, dni, fingerprint) para que otro proceso resuelva por `sub` con UNA
 * sola lectura, sin depender de `flow:{sessionHandle}` ni del shape completo.
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

  async linkSub(userSub: string, clientInfo: SessionClientInfo, ttlSeconds: number): Promise<void> {
    await this.client.set(SUB_KEY_PREFIX + userSub, JSON.stringify(clientInfo), 'EX', ttlSeconds);
  }

  async findByUserSub(userSub: string): Promise<SessionClientInfo | undefined> {
    const raw = await this.client.get(SUB_KEY_PREFIX + userSub);
    if (!raw) return undefined;
    return JSON.parse(raw) as SessionClientInfo;
  }
}
