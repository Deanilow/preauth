export const contextInitBodySchema = {
  type: 'object',
  properties: {
    channel: { type: 'string', enum: ['web', 'app'] },
    fingerprint: { type: 'string', minLength: 32, maxLength: 128 },
    captchaToken: { type: 'string', minLength: 10 },
    // Hooks de simulacion, no contractuales
    debug: {
      type: 'object',
      properties: {
        forceRiskDecision: { type: 'string', enum: ['allow', 'challenge', 'deny'] },
        antiBotScore: { type: 'number', minimum: 0, maximum: 1 },
        clientIp: { type: 'string', format: 'ipv4' },
      },
      additionalProperties: false,
    },
  },
  required: ['channel', 'fingerprint', 'captchaToken'],
  additionalProperties: false,
} as const;
