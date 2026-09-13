/** DI token registry for the messenger service. */
export const DI_TOKENS = {
  // HTTP
  HttpClientService: 'HttpClientService',

  // Clients
  SessionServiceClient: 'SessionServiceClient',

  // Auth / Cache / Sms
  JwtVerifierPort: 'JwtVerifierPort',
  OtpStorePort: 'OtpStorePort',
  SmsSenderPort: 'SmsSenderPort',

  // Use Cases
  OtpInputPort: 'OtpInputPort',

  // Controllers
  OtpController: 'OtpController',
} as const;
