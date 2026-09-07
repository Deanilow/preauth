import { createHash, randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '../../infrastructure/di/tokens';
import { SessionStatePort } from '../ports/output/session-state.port';
import {
  SessionInputPort,
  CreateSessionRequest,
  CreateSessionResponse,
  SessionStateResponse,
  AdvanceStepRequest,
} from '../ports/input/session.input';
import { OnboardingStep, SessionRecord, SessionClientInfo } from '../../domain/entities/session-state';
import { logger } from 'app/infrastructure/logger';
import { BusinessError } from 'src/shared/errors/integration.error';

const INITIAL_STEP: OnboardingStep = 'context_issued';
const INITIAL_TTL_SECONDS = 120;
// Techo absoluto de vida del flujo completo: ningún paso puede extefnder la sesión
// más allá de esta ventana desde su creación, sin importar cuántos avances ocurran.
const ABSOLUTE_SESSION_TTL_SECONDS = 900;

// Transición estricta de la state machine: no se puede saltar ni retroceder.
// TTL por paso según contrato (orden del código):
//   context_issued -> otp_pending 180s | otp_pending -> ocr_pending 180s
//   ocr_pending -> face_pending 120s | face_pending -> password_pending 300s
//   password_pending -> completed 60s
const STEP_TRANSITIONS: Partial<Record<OnboardingStep, { next: OnboardingStep; ttlSeconds: number }>> = {
  context_issued: { next: 'otp_pending', ttlSeconds: 180 },
  otp_pending: { next: 'ocr_pending', ttlSeconds: 180 },
  ocr_pending: { next: 'face_pending', ttlSeconds: 120 },
  face_pending: { next: 'password_pending', ttlSeconds: 300 },
  password_pending: { next: 'completed', ttlSeconds: 60 },
};

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

const toResponse = (record: SessionRecord): SessionStateResponse => ({
  sessionHandle: record.sessionHandle,
  step: record.step,
  channel: record.channel,
  completedSteps: record.completedSteps,
  createdAt: record.createdAt,
  stepExpiry: record.stepExpiry,
  dni: record.dni,
  userSub: record.userSub,
  fingerprint: record.fingerprint,
});

@injectable()
export class SessionUseCase implements SessionInputPort {
  constructor(
    @inject(DI_TOKENS.SessionStatePort)
    private readonly sessionState: SessionStatePort,
  ) { }

  async createSession(req: CreateSessionRequest): Promise<CreateSessionResponse> {
    const sessionHandle = randomUUID();
    const now = new Date();
    const stepExpiry = new Date(now.getTime() + INITIAL_TTL_SECONDS * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_SESSION_TTL_SECONDS * 1000);

    const record: SessionRecord = {
      sessionHandle,
      step: INITIAL_STEP,
      channel: req.channel,
      ipHash: sha256Hex(req.clientIp),
      fingerprint: req.fingerprint,
      correlationId: req.correlationId,
      completedSteps: [],
      createdAt: now.toISOString(),
      stepExpiry: stepExpiry.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
    };

    await this.sessionState.save(sessionHandle, record, INITIAL_TTL_SECONDS);

    logger.info({ correlationId: req.correlationId, sessionHandle }, '[Session] created (context_issued)');

    return { sessionHandle, step: INITIAL_STEP, expiresIn: INITIAL_TTL_SECONDS };
  }

  async getSession(sessionHandle: string): Promise<SessionStateResponse> {
    const record = await this.findOrThrow(sessionHandle);
    return toResponse(record);
  }

  async getSessionByUserSub(userSub: string): Promise<SessionClientInfo> {
    const clientInfo = await this.sessionState.findByUserSub(userSub);
    if (!clientInfo) {
      throw new BusinessError('SESSION_NOT_FOUND', `userSub=${userSub}`);
    }
    return clientInfo;
  }

  async advanceStep(sessionHandle: string, req: AdvanceStepRequest): Promise<SessionStateResponse> {
    const record = await this.findOrThrow(sessionHandle);
    console.log('record.step', record.step, 'req.fromStep', req.fromStep, 'req.toStep', req.toStep);
    if (record.step !== req.fromStep) {
      throw new BusinessError(
        'STEP_MISMATCH',
        `Session is at step '${record.step}', cannot advance from '${req.fromStep}'`,
      );
    }

    const transition = STEP_TRANSITIONS[record.step];
    if (!transition || transition.next !== req.toStep) {
      throw new BusinessError(
        'STEP_MISMATCH',
        `Cannot advance from '${req.fromStep}' to '${req.toStep}'`,
      );
    }

    const now = new Date();
    const secondsUntilAbsoluteExpiry = Math.floor(
      (new Date(record.absoluteExpiresAt).getTime() - now.getTime()) / 1000,
    );
    if (secondsUntilAbsoluteExpiry <= 0) {
      throw new BusinessError('SESSION_EXPIRED', `sessionHandle=${sessionHandle} exceeded the ${ABSOLUTE_SESSION_TTL_SECONDS}s absolute TTL`);
    }

    const effectiveTtlSeconds = Math.min(transition.ttlSeconds, secondsUntilAbsoluteExpiry);

    const updated: SessionRecord = {
      ...record,
      ...req.metadata,
      step: transition.next,
      completedSteps: [...record.completedSteps, record.step],
      stepExpiry: new Date(now.getTime() + effectiveTtlSeconds * 1000).toISOString(),
    };

    await this.sessionState.save(sessionHandle, updated, effectiveTtlSeconds);

    // Se refresca en cada avance (no solo cuando llega en el metadata de este paso puntual)
    // para que el índice `sub:{userSub}` nunca quede con un TTL más corto que `flow:{sessionHandle}`.
    // Guarda la proyección del cliente (sessionHandle, userSub, dni, fingerprint) para que
    // otro proceso resuelva por sub con una sola lectura a Redis.
    if (updated.userSub) {
      await this.sessionState.linkSub(
        updated.userSub,
        {
          sessionHandle,
          userSub: updated.userSub,
          dni: updated.dni,
          fingerprint: updated.fingerprint,
        },
        effectiveTtlSeconds,
      );
    }

    logger.info({ sessionHandle, step: updated.step }, '[Session] advanced');

    return toResponse(updated);
  }

  async invalidateSession(sessionHandle: string): Promise<void> {
    await this.sessionState.delete(sessionHandle);
    logger.info({ sessionHandle }, '[Session] invalidated');
  }

  async verifyOtp(sessionHandle: string, otpCode: string): Promise<{ valid: boolean }> {
    const record = await this.findOrThrow(sessionHandle);

    if (record.step !== 'otp_pending') {
      throw new BusinessError('STEP_MISMATCH', `Session is at step '${record.step}', expected 'otp_pending'`);
    }

    const notExpired = !record.otpExpiresAt || new Date(record.otpExpiresAt).getTime() > Date.now();
    const valid = Boolean(record.otpCode) && record.otpCode === otpCode && notExpired;

    return { valid };
  }

  private async findOrThrow(sessionHandle: string): Promise<SessionRecord> {
    const record = await this.sessionState.find(sessionHandle);
    if (!record) {
      throw new BusinessError('SESSION_NOT_FOUND', `sessionHandle=${sessionHandle}`);
    }
    return record;
  }
}
