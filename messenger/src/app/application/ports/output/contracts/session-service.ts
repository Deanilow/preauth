/** Contrato de salida hacia Session Service (solo para validar el paso y el flujo actual). */

export interface SessionStateResponse {
  sessionHandle: string;
  flowType: string;
  step: string;
  channel: string;
  stepExpiry: string;
}
