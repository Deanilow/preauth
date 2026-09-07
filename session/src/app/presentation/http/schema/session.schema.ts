import { commonErrorResponses } from 'src/shared/schema/errorResponseSchema';

const onboardingStepEnum = [
  'context_issued',
  'otp_pending',
  'face_pending',
  'ocr_pending',
  'password_pending',
  'completed',
];

const sessionStateResponse = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string' },
    step: { type: 'string', enum: onboardingStepEnum },
    channel: { type: 'string', enum: ['web', 'app'] },
    completedSteps: { type: 'array', items: { type: 'string', enum: onboardingStepEnum } },
    createdAt: { type: 'string' },
    stepExpiry: { type: 'string' },
    dni: { type: 'string', description: 'DNI capturado en /onboarding/start. Dato sensible (PII): solo para consumo service-to-service.' },
    userSub: { type: 'string', description: 'GUID que representa al DNI, presente una vez capturado en /onboarding/start.' },
    fingerprint: { type: 'string', description: 'Hash del fingerprint del dispositivo, usado por Device Enrollment.' },
  },
};

const correlationIdHeader = {
  type: 'object',
  required: ['x-correlation-id'],
  properties: {
    'x-correlation-id': { type: 'string', format: 'uuid' },
  },
  additionalProperties: true,
};

// Proyección del cliente almacenada en `sub:{userSub}`. Se resuelve por sub con
// UNA sola lectura a Redis, devolviendo los datos del cliente (no el estado completo).
const sessionClientInfoResponse = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string' },
    userSub: { type: 'string' },
    dni: { type: 'string', description: 'DNI capturado en /onboarding/start. Dato sensible (PII): solo para consumo service-to-service.' },
    fingerprint: { type: 'string', description: 'Hash del fingerprint del dispositivo.' },
  },
};

export const createSessionSchema = {
  summary: 'Crear sesión de onboarding',
  description: 'Crea una nueva sesión en Redis con estado inicial `context_issued` y TTL de 120 segundos.',
  tags: ['sessions'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['channel', 'clientIp', 'fingerprint', 'correlationId'],
    additionalProperties: false,
    properties: {
      channel: { type: 'string', enum: ['web', 'app'] },
      clientIp: { type: 'string', format: 'ipv4' },
      fingerprint: { type: 'string', minLength: 32, maxLength: 128 },
      correlationId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        sessionHandle: { type: 'string' },
        step: { type: 'string', enum: onboardingStepEnum },
        expiresIn: { type: 'number' },
      },
    },
    ...commonErrorResponses,
  },
};

export const getSessionSchema = {
  summary: 'Obtener estado de una sesión',
  description: 'Recupera el estado actual de la sesión desde Redis. Si el TTL venció, devuelve 404.',
  tags: ['sessions'],
  security: [{ bearerAuth: [] }],
  headers: correlationIdHeader,
  params: {
    type: 'object',
    required: ['sessionHandle'],
    properties: {
      sessionHandle: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: sessionStateResponse,
    ...commonErrorResponses,
  },
};

export const getSessionByUserSubSchema = {
  summary: 'Obtener datos del cliente por sub (GUID del DNI)',
  description: 'Resuelve el índice `sub:{userSub}` en Redis (creado en context_issued->otp_pending) y devuelve la proyección del cliente: sessionHandle, userSub, dni y fingerprint. Pensado para que otros servicios (ej. flujo legacy) obtengan los datos del cliente por su `sub` sin conocer el sessionHandle ni el estado completo. Devuelve 404 si el `sub` no existe o ya expiró.',
  tags: ['sessions'],
  security: [{ bearerAuth: [] }],
  headers: correlationIdHeader,
  params: {
    type: 'object',
    required: ['userSub'],
    additionalProperties: false,
    properties: {
      userSub: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: sessionClientInfoResponse,
    ...commonErrorResponses,
  },
};

export const advanceStepSchema = {
  summary: 'Avanzar al siguiente paso de la state machine',
  description: 'Mueve la sesión al siguiente paso y actualiza el TTL. No se puede saltar ni retroceder pasos. El TTL efectivo nunca supera el techo absoluto de 900s desde la creación de la sesión.',
  tags: ['sessions'],
  security: [{ bearerAuth: [] }],
  headers: correlationIdHeader,
  params: {
    type: 'object',
    required: ['sessionHandle'],
    properties: {
      sessionHandle: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['fromStep', 'toStep'],
    additionalProperties: false,
    properties: {
      fromStep: { type: 'string', enum: onboardingStepEnum },
      toStep: { type: 'string', enum: onboardingStepEnum },
      metadata: {
        type: 'object',
        additionalProperties: false,
        description: 'Datos capturados en el paso (ej: dni + userSub en context_issued->otp_pending, otpCode al generarlo).',
        properties: {
          dni: { type: 'string', pattern: '^[0-9]{8}$' },
          userSub: { type: 'string', format: 'uuid' },
          otpCode: { type: 'string' },
          otpExpiresAt: { type: 'string' },
        },
      },
    },
  },
  response: {
    200: sessionStateResponse,
    ...commonErrorResponses,
  },
};

export const invalidateSessionSchema = {
  summary: 'Invalidar una sesión',
  description: 'Elimina la sesión de Redis inmediatamente. Idempotente: 204 aunque ya no exista.',
  tags: ['sessions'],
  security: [{ bearerAuth: [] }],
  headers: correlationIdHeader,
  params: {
    type: 'object',
    required: ['sessionHandle'],
    properties: {
      sessionHandle: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    204: { type: 'null' },
    ...commonErrorResponses,
  },
};

export const verifyOtpSchema = {
  summary: 'Validar el OTP de la sesión',
  description: 'Compara el OTP recibido contra el valor almacenado en Redis. El OTP nunca se expone por GET; solo este endpoint puede validarlo.',
  tags: ['sessions'],
  security: [{ bearerAuth: [] }],
  headers: correlationIdHeader,
  params: {
    type: 'object',
    required: ['sessionHandle'],
    properties: {
      sessionHandle: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['otpCode'],
    additionalProperties: false,
    properties: {
      otpCode: { type: 'string', minLength: 4, maxLength: 8 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
      },
    },
    ...commonErrorResponses,
  },
};
