export const startBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    dni: { type: 'string', minLength: 6, maxLength: 20, pattern: '^[0-9]+$' },
  },
  required: ['sessionHandle', 'dni'],
  additionalProperties: false,
} as const;
