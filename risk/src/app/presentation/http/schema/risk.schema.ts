import { commonErrorResponses } from 'src/shared/schema/errorResponseSchema';

export const evaluateRiskSchema = {
  summary: 'Evaluar riesgo de un request',
  description: `
Calcula un score 0-100 combinando señales técnicas: reputacion IP, velocity (ventana
deslizante de 5 min por clientIp), antiBotScore + metadata de hCaptcha (Enterprise/Pro),
historial del fingerprint (fingerprintKnown / newDevice / travelAnomaly /
userAgentConsistent) y metadata de dispositivo nativo (Play Integrity / DeviceCheck).

### Fuentes del score
| Señal | Peso |
|-------|------|
| antiBotScore (confianza) | 0-60 pts base |
| IP en denylist / suspicious | +40 / +20 |
| velocity exceeded / warning | +25 / +10 |
| device: fail / rooted / emulator / unknown | +40 / +30 / +25 / +15 |
| travelAnomaly | +15 |
| userAgent inconsistente | +10 |
| botScore (hCaptcha) >= .7/.5/.3 | +35 / +20 / +10 |
| botScoreReason (Enterprise) | +5 por razón (cap 25) |
| errorCodes pese a success | +10 |
| modo bypass (sin secret) | +15 |

### Reglas de decision
| score | decision |
|-------|----------|
| 0-24 | allow |
| 25-64 | challenge |
| 65-100 | deny |

**Fail closed**: quien llama a este servicio debe denegar el request si este endpoint
no responde (timeout, 5xx, red) — nunca asumir \`allow\` por defecto.

\`deviceMetadata\` es opcional: si el cliente nativo lo envía (Play Integrity / DeviceCheck)
mejora la precision; si no, no rompe el flujo.
  `,
  tags: ['risk-engine'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['clientIp', 'fingerprint', 'userAgent', 'channel', 'antiBotScore', 'correlationId'],
    additionalProperties: false,
    properties: {
      clientIp: { type: 'string', minLength: 1, maxLength: 64 },
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
          rawBotScore: { type: 'number' },
          scoreLevel: { type: 'string' },
          pass: { type: 'boolean' },
        },
      },
      deviceMetadata: {
        type: 'object',
        description: 'Metadata de dispositivo nativo (Play Integrity / DeviceCheck). Opcional: enriquece el score.',
        properties: {
          provider: { type: 'string', enum: ['play_integrity', 'device_check', 'app_attest', 'web'] },
          verdict: {
            type: 'string',
            enum: ['MEETS_DEVICE_INTEGRITY', 'MEETS_BASIC_INTEGRITY', 'MEETS_STRONG_INTEGRITY', 'pass', 'fail', 'unknown'],
          },
          appVersion: { type: 'string' },
          os: { type: 'string', enum: ['android', 'ios', 'web'] },
          osVersion: { type: 'string' },
          model: { type: 'string' },
          manufacturer: { type: 'string' },
          isEmulator: { type: 'boolean' },
          isRooted: { type: 'boolean' },
          attestationToken: { type: 'string' },
        },
      },
      correlationId: { type: 'string', minLength: 1, maxLength: 64 },
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
            ipReputation: { type: 'string', enum: ['clean', 'suspicious', 'blacklisted', 'tor', 'vpn', 'proxy'] },
            fingerprintKnown: { type: 'boolean' },
            userAgentConsistent: { type: 'boolean' },
            antiBotScore: { type: 'number' },
            velocityCheck: { type: 'string', enum: ['ok', 'warning', 'exceeded'] },
            newDevice: { type: 'boolean' },
            travelAnomaly: { type: 'boolean' },
            antiBotMetadata: { type: 'object', additionalProperties: true },
            deviceMetadata: { type: 'object', additionalProperties: true },
            breakdown: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    ...commonErrorResponses,
  },
};
