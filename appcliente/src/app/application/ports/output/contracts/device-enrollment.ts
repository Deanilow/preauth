/** Contrato de salida hacia Device Enrollment Service (servicio externo, otro repo/equipo). */

export interface EnrollDeviceRequest {
  userSub: string;
  deviceFingerprint: string;
  channel: string;
  correlationId: string;
}

export interface EnrollDeviceResponse {
  enrolled: boolean;
  deviceId?: string;
}
