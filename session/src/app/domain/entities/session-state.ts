import { Channel } from './channel';

/**
 * Tipo de flujo. Cada flujo tiene su propia máquina de estados (pasos + TTLs).
 * El `flowType` se define al crear la sesión y NO cambia durante el flujo.
 */
export type FlowType = 'onboarding' | 'appclient';

export type OnboardingStep =
  | 'context_issued'
  | 'otp_pending'
  | 'ocr_pending'
  | 'face_pending'
  | 'password_pending'
  | 'enroll_device_pending'
  | 'completed';

/**
 * Paso genérico de una máquina de estados. Es `string` (no enum estricto) porque
 * cada flujo define sus propios pasos. Los pasos del onboarding siguen tipados en
 * `OnboardingStep`.
 */
export type FlowStep = string;

export interface SessionMetadata {
  dni?: string;
  userSub?: string;
  otpCode?: string;
  otpExpiresAt?: string;
}

export interface SessionRecord extends SessionMetadata {
  sessionHandle: string;
  /** Flujo al que pertenece la sesión (define qué máquina de estados aplica). */
  flowType: FlowType;
  step: FlowStep;
  channel: Channel;
  ipHash: string;
  fingerprint: string;
  correlationId: string;
  completedSteps: FlowStep[];
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
