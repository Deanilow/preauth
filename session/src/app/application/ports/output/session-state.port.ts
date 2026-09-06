import { SessionRecord } from '../../../domain/entities/session-state';

export interface SessionStatePort {
  save(sessionHandle: string, record: SessionRecord, ttlSeconds: number): Promise<void>;
  find(sessionHandle: string): Promise<SessionRecord | undefined>;
  delete(sessionHandle: string): Promise<void>;
  linkSub(userSub: string, sessionHandle: string, ttlSeconds: number): Promise<void>;
  findByUserSub(userSub: string): Promise<SessionRecord | undefined>;
}
