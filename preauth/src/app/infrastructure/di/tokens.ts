export const DI_TOKENS = {
  // HTTP
  HttpClientService: 'HttpClientService',

  AntiBotClient: 'AntiBotClient',
  RiskEngineClient: 'RiskEngineClient',
  TokenServiceClient: 'TokenServiceClient',
  SessionServiceClient: 'SessionServiceClient',

  // Ports

  // Use Cases
  PreAuthInputPort: 'PreAuthInputPort',

  // Controllers
  PreAuthController: 'PreAuthController',

  // Services

  // Legacy (mantener compatibilidad)
} as const;