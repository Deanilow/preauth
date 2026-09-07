import { Channel } from '../../../domain/entities/channel';
import { OnboardingStep, SessionMetadata, SessionClientInfo } from '../../../domain/entities/session-state';

export interface CreateSessionRequest {
  channel: Channel;
  clientIp: string;
  fingerprint: string;
  correlationId: string;
}

export interface CreateSessionResponse {
  sessionHandle: string;
  step: OnboardingStep;
  expiresIn: number;
}

export interface SessionStateResponse {
  sessionHandle: string;
  step: OnboardingStep;
  channel: Channel;
  completedSteps: OnboardingStep[];
  createdAt: string;
  stepExpiry: string;
  dni?: string;
  userSub?: string;
  fingerprint: string;
}

export interface AdvanceStepRequest {
  fromStep: OnboardingStep;
  toStep: OnboardingStep;
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
