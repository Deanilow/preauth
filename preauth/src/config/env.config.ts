export type EnvironmentValidationIssue = {
  name: string;
  reason: string;
};

const REQUIRED_ENV_VARS = [
  'SERVICE_API_KEY',
  'ANTI_BOT_URL',
  'RISK_ENGINE_URL',
  'TOKEN_SERVICE_URL',
  'SESSION_SERVICE_URL',
] as const;

export const validateEnvironment = (): void => {
  const issues: EnvironmentValidationIssue[] = REQUIRED_ENV_VARS
    .filter((name) => !process.env[name])
    .map((name) => ({ name, reason: `required - [sur-auth-ms-onboarding-preauth-orchestrator]` }));

  if (issues.length > 0) {
    const missingVars = issues.map((i) => `  - ${i.name}`).join('\n');
    const error = new Error(
      `Invalid environment configuration - [sur-auth-ms-onboarding-preauth-orchestrator]\n` +
      `Missing variables:\n${missingVars}`
    ) as Error & { issues: EnvironmentValidationIssue[] };
    error.issues = issues;
    throw error;
  }
};