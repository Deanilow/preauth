export interface GenerateOtpBodyDto {
  sessionHandle: string;
}

export interface GenerateOtpResponseDto {
  sessionHandle: string;
  expiresIn: number;
}

export interface VerifyOtpBodyDto {
  sessionHandle: string;
  otpCode: string;
}

export interface VerifyOtpResponseDto {
  valid: boolean;
}
