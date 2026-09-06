export const selectProductsBodySchema = {
  type: 'object',
  properties: {
    sessionHandle: { type: 'string', minLength: 8, maxLength: 128 },
    productIds: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 64 },
      minItems: 1,
      maxItems: 20,
    },
  },
  required: ['sessionHandle', 'productIds'],
  additionalProperties: false,
} as const;
