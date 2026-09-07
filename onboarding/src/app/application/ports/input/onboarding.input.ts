import { Channel } from '../../../domain/entities/channel';
import { OnboardingStep } from '../../../domain/entities/onboarding-step';

export interface RequestContext {
  clientIp: string;
  userAgent: string;
  correlationId: string;
  requestId: string; 
}

export interface StartRequest {
  contextToken: string;
  sessionHandle: string;
  dni: string;
  ctx: RequestContext;
}

export interface StartResponse {
  sessionToken: string;
  step: OnboardingStep;
  expiresIn: number;
}

export interface VerifyOtpRequest {
  sessionToken: string;
  sessionHandle: string;
  ctx: RequestContext;
}

export interface VerifyFaceRequest {
  sessionToken: string;
  sessionHandle: string;
  ctx: RequestContext;
}

export interface VerifyOcrRequest {
  sessionToken: string;
  sessionHandle: string;
  ctx: RequestContext;
}

export interface SelectProductsRequest {
  sessionToken: string;
  sessionHandle: string;
  productIds: string[];
  ctx: RequestContext;
}

export interface CreatePasswordRequest {
  sessionToken: string;
  sessionHandle: string;
  password: string;
  ctx: RequestContext;
}

export interface StepAdvancedResponse {
  step: OnboardingStep;
  sub?: string;
}

export interface OnboardingInputPort {
  start(req: StartRequest): Promise<StartResponse>;
  verifyOtp(req: VerifyOtpRequest): Promise<StepAdvancedResponse>;
  verifyFace(req: VerifyFaceRequest): Promise<StepAdvancedResponse>;
  verifyOcr(req: VerifyOcrRequest): Promise<StepAdvancedResponse>;
  selectProducts(req: SelectProductsRequest): Promise<StepAdvancedResponse>;
  // createPassword(req: CreatePasswordRequest): Promise<StepAdvancedResponse>;
}

export type { Channel };
