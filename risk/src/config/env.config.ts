export type EnvironmentValidationIssue = {
  name: string;
  reason: string;
};

// Todas las vars activas (SERVICE_API_KEY, HCAPTCHA_*) tienen fallback/modo bypass en
// ClientConstants, asi que no hay ninguna estrictamente requerida para arrancar.
const REQUIRED_ENV_VARS = [] as const;

export const validateEnvironment = (): void => {
  const issues: EnvironmentValidationIssue[] = REQUIRED_ENV_VARS
    .filter((name) => !process.env[name])
    .map((name) => ({ name, reason: `required - [sur-auth-ms-onboarding-risk-engine]` }));

  if (issues.length > 0) {
    const missingVars = issues.map((i) => `  - ${i.name}`).join('\n');
    const error = new Error(
      `Invalid environment configuration - [sur-auth-ms-onboarding-risk-engine]\n` +
      `Missing variables:\n${missingVars}`
    ) as Error & { issues: EnvironmentValidationIssue[] };
    error.issues = issues;
    throw error;
  }
};