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
