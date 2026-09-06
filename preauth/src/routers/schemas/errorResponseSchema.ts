export const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'level'],
      properties: {
        code: { type: 'string', minLength: 1, maxLength: 128 },
        message: { type: 'string', minLength: 1, maxLength: 500 },
        level: { type: 'string', enum: ['error', 'warning', 'info'] },
        description: { type: 'string', maxLength: 10000 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;