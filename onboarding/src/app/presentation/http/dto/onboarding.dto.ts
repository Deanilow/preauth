import { OnboardingStep } from '../../../domain/entities/onboarding-step';

export interface StartBodyDto {
  sessionHandle: string;
  dni: string;
}

export interface StartResponseDto {
  sessionToken: string;
  step: OnboardingStep;
  expiresIn: number;
}

export interface VerifyOtpBodyDto {
  sessionHandle: string;
  otpCode?: string;
}

export interface VerifyFaceBodyDto {
  sessionHandle: string;
  faceToken?: string;
}

export interface VerifyOcrBodyDto {
  sessionHandle: string;
  ocrToken?: string;
}

export interface SelectProductsBodyDto {
  sessionHandle: string;
  productIds: string[];
}

export interface CreatePasswordBodyDto {
  sessionHandle: string;
  password: string;
}

export interface StepAdvancedResponseDto {
  step: OnboardingStep;
  sub?: string;
}
