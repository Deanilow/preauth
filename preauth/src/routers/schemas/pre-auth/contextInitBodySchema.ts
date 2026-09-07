export const contextInitBodySchema = {
  type: 'object',
  properties: {
    channel: { type: 'string', enum: ['web', 'app'] },
    fingerprint: { type: 'string', minLength: 32, maxLength: 128 },
    captchaToken: { type: 'string', minLength: 10 },
  },
  required: ['channel', 'fingerprint', 'captchaToken'],
  additionalProperties: false,
} as const;
