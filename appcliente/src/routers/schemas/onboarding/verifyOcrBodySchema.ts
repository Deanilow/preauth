export const verifyOcrBodySchema = {
  type: 'object',
  properties: {
    // El ocrToken NO se recibe: la validación de OCR la realiza un proceso externo.
    // Este orquestador solo avanza la state machine con el sessionHandle.
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
  },
  required: ['sessionHandle'],
  additionalProperties: false,
} as const;
