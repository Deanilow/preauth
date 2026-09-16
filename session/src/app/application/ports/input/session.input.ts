import { Channel } from '../../../domain/entities/channel';
import { FlowType, FlowStep, SessionMetadata, SessionClientInfo } from '../../../domain/entities/session-state';

export interface CreateSessionRequest {
  /** Flujo al que pertenece la sesión: define su máquina de estados. */
  flowType: FlowType;
  channel: Channel;
  clientIp: string;
  fingerprint: string;
  /** Datos propios del flujo (se persisten en la sesión). */
  context?: Record<string, unknown>;
  correlationId: string;
}

export interface CreateSessionResponse {
  sessionHandle: string;
  flowType: FlowType;
  step: FlowStep;
  expiresIn: number;
}

export interface SessionStateResponse {
  sessionHandle: string;
  flowType: FlowType;
  step: FlowStep;
  channel: Channel;
  completedSteps: FlowStep[];
  createdAt: string;
  stepExpiry: string;
  dni?: string;
  userSub?: string;
  fingerprint: string;
}

export interface AdvanceStepRequest {
  fromStep: FlowStep;
  toStep: FlowStep;
  /** Datos capturados en el paso (ej: dni + userSub en /onboarding/start, otpCode al generarlo). */
  metadata?: SessionMetadata;
}

export interface VerifyOtpResponse {
  valid: boolean;
}

export interface SessionInputPort {
  createSession(req: CreateSessionRequest): Promise<CreateSessionResponse>;
  getSession(sessionHandle: string): Promise<SessionStateResponse>;
  getSessionByUserSub(userSub: string): Promise<SessionClientInfo>;
  advanceStep(sessionHandle: string, req: AdvanceStepRequest): Promise<SessionStateResponse>;
  invalidateSession(sessionHandle: string): Promise<void>;
  verifyOtp(sessionHandle: string, otpCode: string): Promise<VerifyOtpResponse>;
}
