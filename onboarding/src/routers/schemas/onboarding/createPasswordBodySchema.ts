export const createPasswordBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
  required: ['sessionHandle', 'password'],
  additionalProperties: false,
} as const;
