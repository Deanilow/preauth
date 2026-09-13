export const verifyOtpBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    otpCode: { type: 'string', minLength: 6, maxLength: 6 },
  },
  required: ['sessionHandle', 'otpCode'],
  additionalProperties: false,
} as const;
