import { commonErrorResponses } from 'src/shared/schema/errorResponseSchema';

export const evaluateRiskSchema = {
  summary: 'Evaluar riesgo de un request',
  description: `
Calcula un score 0-100 combinando IP, fingerprint, userAgent, canal, antiBotScore y
velocity (ventana deslizante de 5 min por fingerprint, en memoria del propio proceso).

### Reglas de decision
| score | decision |
|-------|----------|
| 0-24 | allow |
| 25-64 | challenge |
| 65-100 | deny |

**Fail closed**: quien llama a este servicio debe denegar el request si este endpoint
no responde (timeout, 5xx, red) — nunca asumir \`allow\` por defecto.

\`forceDecision\` es un hook de simulacion, no contractual, para poder probar las 3
ramas sin fabricar IPs/fingerprints reales.
  `,
  tags: ['risk-engine'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['clientIp', 'fingerprint', 'userAgent', 'channel', 'antiBotScore', 'correlationId'],
    additionalProperties: false,
    properties: {
      clientIp: { type: 'string', format: 'ipv4' },
      fingerprint: { type: 'string', minLength: 32, maxLength: 128 },
      userAgent: { type: 'string', maxLength: 512 },
      channel: { type: 'string', enum: ['web', 'app'] },
      antiBotScore: { type: 'number', minimum: 0, maximum: 1 },
      antiBotMetadata: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
          mode: { type: 'string', enum: ['live', 'bypass'] },
          hostname: { type: 'string' },
          challengeTs: { type: 'string' },
          errorCodes: { type: 'array', items: { type: 'string' } },
          botScore: { type: 'number' },
          botScoreReason: { type: 'array', items: { type: 'string' } },
        },
      },
      correlationId: { type: 'string', format: 'uuid' },
      forceDecision: { type: 'string', enum: ['allow', 'challenge', 'deny'] },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        score: { type: 'number' },
        decision: { type: 'string', enum: ['allow', 'challenge', 'deny'] },
        signals: {
          type: 'object',
          properties: {
            ipReputation: { type: 'string', enum: ['clean', 'blacklisted'] },
            fingerprintKnown: { type: 'boolean' },
            userAgentConsistent: { type: 'boolean' },
            antiBotScore: { type: 'number' },
            velocityCheck: { type: 'string', enum: ['ok', 'warning', 'exceeded'] },
            newDevice: { type: 'boolean' },
            antiBotMetadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    ...commonErrorResponses,
  },
};
