/** DI token registry for the onboarding-orchestrator service. */
export const DI_TOKENS = {
  // Onboarding
  OnboardingInputPort: 'OnboardingInputPort',
  OnboardingController: 'OnboardingController',

  // HTTP
  HttpClientService: 'HttpClientService',

  // Clients
  TokenServiceClient: 'TokenServiceClient',
  SessionServiceClient: 'SessionServiceClient',
  DeviceEnrollmentClient: 'DeviceEnrollmentClient',

  // Auth / Cache
  JwtVerifierPort: 'JwtVerifierPort',
  ReplayStorePort: 'ReplayStorePort',
} as const;
