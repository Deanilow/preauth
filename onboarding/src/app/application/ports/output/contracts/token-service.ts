/** Contrato de salida hacia Token Service (emisión de JWTs y JWKS). */


export interface EmitTokenResponse {
  token: string;
  jti: string;
  expiresIn: number;
}

export interface EmitSessionTokenRequest {
  sessionHandle: string;
  channel: string;
  clientIp: string;
  correlationId: string;
}

/** Claims verificados de un contextToken (aud=preauth-api, scope=preauth:onboarding.start). */
export interface ContextTokenClaims {
  [claim: string]: unknown;
  iss?: string;
  aud?: string;
  scope?: string;
  channel?: string;
  jti?: string;
  fp?: string;
  ipHash?: string;
  exp?: number;
  iat?: number;
}

/** Claims verificados de un sessionToken (aud=onboarding-service, scope=onboarding:steps). */
export interface SessionTokenClaims {
  [claim: string]: unknown;
  iss?: string;
  aud?: string;
  scope?: string;
  sub?: string; // 'session:{sessionHandle}'
  channel?: string;
  ipHash?: string;
  jti?: string;
  exp?: number;
  iat?: number;
}
