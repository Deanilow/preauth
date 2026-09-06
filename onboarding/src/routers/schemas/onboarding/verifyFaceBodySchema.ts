export const verifyFaceBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    // No se valida contenido/formato: la validación real del rostro la hace el flujo
    // legacy por fuera de este servicio. Aquí solo se simula el paso.
    faceToken: { type: 'string' },
  },
  required: ['sessionHandle'],
  additionalProperties: false,
} as const;
