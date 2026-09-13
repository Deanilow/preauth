import { commonErrorResponses } from 'src/shared/schema/errorResponseSchema';

const emitTokenResponse = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    jti: { type: 'string' },
    expiresIn: { type: 'number' },
  },
};

export const emitContextTokenSchema = {
  summary: 'Emitir contextToken',
  description: `
Emite un JWT firmado RS256 para la fase de pre-auth.
TTL: 120 segundos, single-use (el receptor consume el \`jti\` en Redis).
  `,
  tags: ['tokens'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['channel', 'fingerprint', 'clientIp', 'correlationId'],
    additionalProperties: false,
    properties: {
      channel: { type: 'string', enum: ['web', 'app'] },
      fingerprint: { type: 'string', minLength: 32, maxLength: 128 },
      clientIp: { type: 'string', format: 'ipv4' },
      correlationId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: emitTokenResponse,
    ...commonErrorResponses,
  },
};

export const emitSessionTokenSchema = {
  summary: 'Emitir sessionToken',
  description: `
Emite un JWT firmado RS256 para los pasos de onboarding.
TTL: 900 segundos (15 minutos), multi-use (anti-replay por X-Request-Id).
  `,
  tags: ['tokens'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['sessionHandle', 'channel', 'clientIp', 'correlationId', 'flowType'],
    additionalProperties: false,
    properties: {
      sessionHandle: { type: 'string', format: 'uuid' },
      channel: { type: 'string', enum: ['web', 'app'] },
      clientIp: { type: 'string', format: 'ipv4' },
      correlationId: { type: 'string', format: 'uuid' },
      flowType: { type: 'string' },
    },
  },
  response: {
    200: emitTokenResponse,
    ...commonErrorResponses,
  },
};

export const getJwksSchema = {
  summary: 'Obtener claves publicas (JWKS)',
  description: 'Expone el JSON Web Key Set con las claves publicas RSA. Publico, sin autenticacion.',
  tags: ['jwks'],
  response: {
    200: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string' },
              use: { type: 'string' },
              alg: { type: 'string' },
              kid: { type: 'string' },
              n: { type: 'string' },
              e: { type: 'string' },
            },
          },
        },
      },
    },
    ...commonErrorResponses,
  },
};
