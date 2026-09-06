import { Channel } from './channel';

export type OnboardingStep =
  | 'context_issued'
  | 'otp_pending'
  | 'ocr_pending'
  | 'face_pending'
  | 'password_pending'
  | 'completed';

export interface SessionMetadata {
  dni?: string;
  userSub?: string;
  otpCode?: string;
  otpExpiresAt?: string;
}

export interface SessionRecord extends SessionMetadata {
  sessionHandle: string;
  step: OnboardingStep;
  channel: Channel;
  ipHash: string;
  fingerprint: string;
  correlationId: string;
  completedSteps: OnboardingStep[];
  createdAt: string;
  stepExpiry: string;
  absoluteExpiresAt: string;
}
