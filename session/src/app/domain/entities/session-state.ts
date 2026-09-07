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

/**
 * Proyección del cliente almacenada en el índice `sub:{userSub}`.
 * Permite que otro proceso resuelva por `sub` (GUID) obteniendo los datos del
 * cliente (DNI, fingerprint, sessionHandle) con UNA sola lectura a Redis, sin
 * depender de conocer `flow:{sessionHandle}` ni del shape completo del registro.
 *
 * Los campos son inmutables durante el flujo (se setean una vez), así que la
 * proyección no necesita re-escribirse salvo para refrescar su TTL.
 */
export interface SessionClientInfo {
  sessionHandle: string;
  userSub: string;
  dni?: string;
  fingerprint: string;
}
