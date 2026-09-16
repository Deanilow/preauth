export const contextInitBodySchema = {
  type: 'object',
  properties: {
    flowType: { type: 'string', enum: ['appclient', 'onboarding', 'otp_only'] },
    channel: { type: 'string', enum: ['web', 'app'] },
    // Datos propios del flujo (objeto libre). Se validan por flujo en el usecase.
    // Ej: appclient → { fingerprint, captchaToken }; otp_only → { deviceUuid }.
    context: { type: 'object', additionalProperties: true },
  },
  required: ['flowType', 'channel', 'context'],
  additionalProperties: false,
} as const;
