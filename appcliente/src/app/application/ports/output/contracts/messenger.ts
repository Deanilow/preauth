/** Contrato de salida hacia Messenger Service (generación/verificación del OTP). */

export interface GenerateOtpRequest {
  sessionHandle: string;
}

export interface GenerateOtpResponse {
  sessionHandle: string;
  expiresIn: number;
}

export interface VerifyOtpRequest {
  sessionHandle: string;
  otpCode: string;
}

export interface VerifyOtpResponse {
  valid: boolean;
}
