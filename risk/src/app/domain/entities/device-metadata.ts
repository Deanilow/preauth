/**
 * Metadata de dispositivo enviada por clientes nativos (Android/iOS).
 *
 * NO es PII: son señales técnicas del dispositivo y del runtime para enriquecer
 * el score de riesgo. Se genera en el cliente y se propaga de forma opcional.
 *
 * Los campos de atestación corresponden a:
 * - Android: Play Integrity API (`provider='play_integrity'`).
 * - iOS: DeviceCheck / App Attest (`provider='device_check'` o `app_attest`).
 *
 * Todos opcionales: su ausencia no rompe el contrato, solo reduce la precisión.
 */
export interface DeviceMetadata {
  /** Origen de la metadata. */
  provider: 'play_integrity' | 'device_check' | 'app_attest' | 'web';
  /** Veredicto de integridad del proveedor (ver enum). */
  verdict?: DeviceIntegrityVerdict;
  /** Version de la app que genero el request. */
  appVersion?: string;
  /** Sistema operativo (android / ios / web). */
  os?: 'android' | 'ios' | 'web';
  /** Version del sistema operativo. */
  osVersion?: string;
  /** Modelo del dispositivo. */
  model?: string;
  /** Fabricante (Android: Build.MANUFACTURER). */
  manufacturer?: string;
  /** Si el runtime es un emulador/simulador (android emulator / iOS Simulator). */
  isEmulator?: boolean;
  /** Si el dispositivo esta rooteado/jailbreakeado. */
  isRooted?: boolean;
  /** Fingerprint/attestation crudo o nonce, si aplica. */
  attestationToken?: string;
}

/** Veredicto de integridad (usa los valores de Play Integrity / App Attest). */
export type DeviceIntegrityVerdict =
  | 'MEETS_DEVICE_INTEGRITY'
  | 'MEETS_BASIC_INTEGRITY'
  | 'MEETS_STRONG_INTEGRITY'
  | 'pass'
  | 'fail'
  | 'unknown';
