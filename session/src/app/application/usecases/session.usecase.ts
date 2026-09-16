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
import { FlowType, FlowStep, SessionRecord, SessionClientInfo } from '../../domain/entities/session-state';
import { logger } from 'app/infrastructure/logger';
import { BusinessError } from 'src/shared/errors/integration.error';

interface FlowTransition {
  next: FlowStep;
  ttlSeconds: number;
}

interface FlowDefinition {
  initialStep: FlowStep;
  initialTtlSeconds: number;
  /** Techo absoluto de vida del flujo completo, en segundos. */
  absoluteTtlSeconds: number;
  transitions: Record<FlowStep, FlowTransition>;
}

/**
 * Registro de máquinas de estados por tipo de flujo.
 *
 * Cada flujo define: paso inicial, TTL inicial, techo absoluto y la tabla de
 * transiciones (paso actual -> { siguiente, ttlSeconds }). La transición es
 * estricta: no se puede saltar ni retroceder.
 *
 * Para agregar un flujo nuevo solo hay que sumar una entrada acá (sin tocar la
 * lógica de `advanceStep` ni el resto del servicio).
 */
const FLOW_DEFINITIONS: Record<FlowType, FlowDefinition> = {
  // Flujo principal: alta de cliente (app). Es el que consume el orquestador.
  appclient: {
    initialStep: 'context_issued',
    initialTtlSeconds: 120,
    absoluteTtlSeconds: 900,
    transitions: {
      context_issued: { next: 'otp_pending', ttlSeconds: 180 },
      otp_pending: { next: 'ocr_pending', ttlSeconds: 180 },
      ocr_pending: { next: 'face_pending', ttlSeconds: 120 },
      face_pending: { next: 'password_pending', ttlSeconds: 300 },
      password_pending: { next: 'enroll_device_pending', ttlSeconds: 60 },
      enroll_device_pending: { next: 'completed', ttlSeconds: 60 },
    },
  },
  // Flujo onboarding (ejemplo): context_issued -> otp_pending -> confirmed -> completed.
  // Mismo orquestador que appclient; sin OCR/face/password.
  onboarding: {
    initialStep: 'context_issued',
    initialTtlSeconds: 120,
    absoluteTtlSeconds: 600,
    transitions: {
      context_issued: { next: 'otp_pending', ttlSeconds: 180 },
      otp_pending: { next: 'confirmed', ttlSeconds: 300 },
      confirmed: { next: 'completed', ttlSeconds: 60 },
    },
  },
  // Flujo solo-OTP: crea sesión, pasa por otp_pending y termina. Sin OCR/face.
  otp_only: {
    initialStep: 'context_issued',
    initialTtlSeconds: 120,
    absoluteTtlSeconds: 600,
    transitions: {
      context_issued: { next: 'otp_pending', ttlSeconds: 180 },
      otp_pending: { next: 'completed', ttlSeconds: 300 },
    },
  },
};

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

const toResponse = (record: SessionRecord): SessionStateResponse => ({
  sessionHandle: record.sessionHandle,
  flowType: record.flowType,
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
    const flow = FLOW_DEFINITIONS[req.flowType];
    if (!flow) {
      throw new BusinessError('REQUEST_VALIDATION_ERROR', `Unknown flowType '${req.flowType}'`);
    }

    const sessionHandle = randomUUID();
    const now = new Date();
    const stepExpiry = new Date(now.getTime() + flow.initialTtlSeconds * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + flow.absoluteTtlSeconds * 1000);

    const record: SessionRecord = {
      sessionHandle,
      flowType: req.flowType,
      step: flow.initialStep,
      channel: req.channel,
      ipHash: sha256Hex(req.clientIp),
      fingerprint: req.fingerprint,
      correlationId: req.correlationId,
      completedSteps: [],
      createdAt: now.toISOString(),
      stepExpiry: stepExpiry.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      context: req.context,
    };

    await this.sessionState.save(sessionHandle, record, flow.initialTtlSeconds);

    logger.info({ correlationId: req.correlationId, sessionHandle, flowType: req.flowType }, `[Session] created (${flow.initialStep})`);

    return { sessionHandle, flowType: req.flowType, step: flow.initialStep, expiresIn: flow.initialTtlSeconds };
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

    const flow = FLOW_DEFINITIONS[record.flowType];
    if (!flow) {
      throw new BusinessError('REQUEST_VALIDATION_ERROR', `Unknown flowType '${record.flowType}'`);
    }

    if (record.step !== req.fromStep) {
      throw new BusinessError(
        'STEP_MISMATCH',
        `Session is at step '${record.step}', cannot advance from '${req.fromStep}'`,
      );
    }

    const transition = flow.transitions[record.step];
    if (!transition || transition.next !== req.toStep) {
      throw new BusinessError(
        'STEP_MISMATCH',
        `Cannot advance from '${req.fromStep}' to '${req.toStep}' in flow '${record.flowType}'`,
      );
    }

    const now = new Date();
    const secondsUntilAbsoluteExpiry = Math.floor(
      (new Date(record.absoluteExpiresAt).getTime() - now.getTime()) / 1000,
    );
    if (secondsUntilAbsoluteExpiry <= 0) {
      throw new BusinessError('SESSION_EXPIRED', `sessionHandle=${sessionHandle} exceeded the ${flow.absoluteTtlSeconds}s absolute TTL`);
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

    logger.info({ sessionHandle, flowType: record.flowType, step: updated.step }, '[Session] advanced');

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