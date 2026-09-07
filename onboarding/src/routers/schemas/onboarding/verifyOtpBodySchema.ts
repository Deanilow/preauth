export const verifyOtpBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
  },
  required: ['sessionHandle'],
  additionalProperties: false,
} as const;
