export type EnvironmentValidationIssue = {
  name: string;
  reason: string;
};

const REQUIRED_ENV_VARS = [
  'TOKEN_PRIVATE_KEY_B64',
  'TOKEN_PUBLIC_KEY_B64',
  'TOKEN_KID',
  'SERVICE_API_KEY',
] as const;

export const validateEnvironment = (): void => {
  const issues: EnvironmentValidationIssue[] = REQUIRED_ENV_VARS
    .filter((name) => !process.env[name])
    .map((name) => ({ name, reason: `required - [sur-auth-ms-onboarding-token-service]` }));

  if (issues.length > 0) {
    const missingVars = issues.map((i) => `  - ${i.name}`).join('\n');
    const error = new Error(
      `Invalid environment configuration - [sur-auth-ms-onboarding-token-service]\n` +
      `Missing variables:\n${missingVars}`
    ) as Error & { issues: EnvironmentValidationIssue[] };
    error.issues = issues;
    throw error;
  }
};