export const verifyOtpBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    // No se valida contenido/formato: la validación real del OTP la hace el flujo
    // legacy por fuera de este servicio. Aquí solo se simula el paso.
    otpCode: { type: 'string' },
  },
  required: ['sessionHandle'],
  additionalProperties: false,
} as const;
