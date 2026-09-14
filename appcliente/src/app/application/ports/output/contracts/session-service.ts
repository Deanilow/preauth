import { OnboardingStep } from '../../../../domain/entities/onboarding-step';

/** Contrato de salida hacia Session Service (estado de sesión sobre Redis). */

export interface SessionMetadata {
  dni?: string;
  userSub?: string;
  otpCode?: string;
  otpExpiresAt?: string;
}

export interface SessionStateResponse {
  sessionHandle: string;
  flowType: string;
  step: OnboardingStep;
  channel: string;
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
  metadata?: SessionMetadata;
}

export interface VerifyOtpResponse {
  valid: boolean;
}
