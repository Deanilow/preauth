import { commonErrorResponses } from 'src/shared/schema/errorResponseSchema';

export const verifyAntiBotSchema = {
  summary: 'Verificar token anti-bot (hCaptcha)',
  description: `
Valida el token de hCaptcha contra el endpoint real \`POST /siteverify\` del proveedor
(no generamos el token, solo lo leemos). Si no hay \`HCAPTCHA_SECRET\` configurado, cae
en modo bypass de desarrollo. Responde siempre \`200\`, incluso cuando el token es
invalido — quien llama decide que hacer con \`verified: false\`.

\`clientIp\` es recomendado (no obligatorio): hCaptcha lo usa como \`remoteip\` para
mejorar precision y habilitar el score Enterprise en la respuesta.

Sin Play Integrity / App Attest en esta version (fuera de alcance).

**Bypass de desarrollo** (solo si no hay \`HCAPTCHA_SECRET\`): el valor \`FORCE_FAIL\`
en \`captchaToken\` simula un captcha invalido.
  `,
  tags: ['anti-bot'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['channel', 'captchaToken'],
    additionalProperties: false,
    properties: {
      channel: { type: 'string', enum: ['web', 'app'] },
      captchaToken: { type: 'string', minLength: 10 },
      clientIp: { type: 'string', format: 'ipv4' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        score: { type: 'number' },
        provider: { type: 'string' },
        metadata: {
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
      },
    },
    ...commonErrorResponses,
  },
};
