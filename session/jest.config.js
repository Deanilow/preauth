module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  silent: false,
  verbose: true,

  collectCoverage: true,
  collectCoverageFrom: [
    'src/shared/errors/integration.error.ts',
  ],
  coverageProvider: 'v8',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'src/app/application/ports/input/session.input.ts',
    'src/app/application/ports/output/session-state.port.ts',
    'src/app/application/usecases/session.usecase.ts',
    'src/app/domain/entities/channel.ts',
    'src/app/domain/entities/session-state.ts',
    'src/app/infrastructure/cache/session-state.service.ts',
    'src/app/infrastructure/clients/base.client.ts',
    'src/app/infrastructure/clients/client.constants.ts',
    'src/app/infrastructure/clients/headers.factory.client.ts',
    'src/app/infrastructure/di/container.ts',
    'src/app/infrastructure/di/tokens.ts',
    'src/app/infrastructure/http/http-client.config.ts',
    'src/app/infrastructure/http/http-client.service.ts',
    'src/app/infrastructure/http/http-client.types.ts',
    'src/app/infrastructure/logger/index.ts',
    'src/app/infrastructure/logger/pino.ts',
    'src/app/presentation/http/controllers/session.controller.ts',
    'src/app/presentation/http/middleware/service-api-key.ts',
    'src/app/presentation/http/schema/session.schema.ts',
    'src/config/darwin.config.ts',
    'src/config/env.config.ts',
    'src/config/fastify.config.ts',
    'src/config/gluon.config.ts',
    'src/routers/index.ts',
    'src/routers/sessions/index.ts',
    'src/server/index.ts',
    'src/shared/errors/errorNormalizer.ts',
    'src/shared/http/http.support.ts',
    'src/shared/http/index.ts',
    'src/shared/schema/errorResponseSchema.ts',
    'src/shared/utils/object.utils.ts',
    'src/shared/utils/retry.ts',
  ],

  roots: ['<rootDir>'],
  testRegex: '(/test/.*\\.(test|spec))\\.(tsx?|jsx?)$',

  testPathIgnorePatterns: [
    '/node_modules/',
    '/api/',
    '\\.data\\.ts$',
    '\\.mock\\.ts$',
    '/test/helpers/',
    '/test/fixtures/',
    '/dist/',
  ],

  moduleFileExtensions: ['ts', 'js', 'json'],

  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/app/',
  ],

  moduleNameMapper: {
    '#node-web-compat': './node-web-compat-node.js'
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      },
      babelConfig: false,
    }]
  },

  extensionsToTreatAsEsm: [],

  setupFiles: ['reflect-metadata'],
  testTimeout: 20000,
  clearMocks: true,
  restoreMocks: true,

  cacheDirectory: '<rootDir>/.jest-cache',
  maxWorkers: '50%',
};