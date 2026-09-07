import { SessionRecord, SessionClientInfo } from '../../../domain/entities/session-state';

export interface SessionStatePort {
  save(sessionHandle: string, record: SessionRecord, ttlSeconds: number): Promise<void>;
  find(sessionHandle: string): Promise<SessionRecord | undefined>;
  delete(sessionHandle: string): Promise<void>;
  /** Guarda el índice sub:{userSub} -> SessionClientInfo (proyección del cliente). */
  linkSub(userSub: string, clientInfo: SessionClientInfo, ttlSeconds: number): Promise<void>;
  /** Resuelve por sub: UNA sola lectura de sub:{userSub}. */
  findByUserSub(userSub: string): Promise<SessionClientInfo | undefined>;
}
