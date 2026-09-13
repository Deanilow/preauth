export interface GenerateOtpRequest {
  sessionToken: string;
  sessionHandle: string;
  ctx: RequestContext;
}

export interface VerifyOtpRequest {
  sessionToken: string;
  sessionHandle: string;
  otpCode: string;
  ctx: RequestContext;
}

export interface RequestContext {
  correlationId: string;
}

export interface GenerateOtpResponse {
  sessionHandle: string;
  /** Segundos hasta la expiración del OTP. */
  expiresIn: number;
}

export interface VerifyOtpResponse {
  valid: boolean;
}

export interface OtpInputPort {
  generate(req: GenerateOtpRequest): Promise<GenerateOtpResponse>;
  verify(req: VerifyOtpRequest): Promise<VerifyOtpResponse>;
}
