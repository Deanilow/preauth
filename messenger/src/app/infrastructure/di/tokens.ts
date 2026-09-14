/** DI token registry for the messenger service. */
export const DI_TOKENS = {
  // HTTP
  HttpClientService: 'HttpClientService',

  // Clients
  SessionServiceClient: 'SessionServiceClient',

  // Auth / Provider
  JwtVerifierPort: 'JwtVerifierPort',
  OtpProviderPort: 'OtpProviderPort',

  // Use Cases
  OtpInputPort: 'OtpInputPort',

  // Controllers
  OtpController: 'OtpController',
} as const;
