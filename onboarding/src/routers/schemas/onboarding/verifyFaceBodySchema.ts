export const verifyFaceBodySchema = {
  type: 'object',
  properties: {
    // El faceToken NO se recibe: la validación biométrica la realiza un proceso externo.
    // Este orquestador solo avanza la state machine con el sessionHandle.
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
  },
  required: ['sessionHandle'],
  additionalProperties: false,
} as const;
