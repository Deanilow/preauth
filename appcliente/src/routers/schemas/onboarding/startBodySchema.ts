export const startBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    // Opcional: requerido para flujos con identificación (appclient/onboarding); no se usa en otp_only.
    dni: { type: 'string', minLength: 6, maxLength: 20, pattern: '^[0-9]+$' },
  },
  required: ['sessionHandle'],
  additionalProperties: false,
} as const;
