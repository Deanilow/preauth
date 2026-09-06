export const RISK_DECISION = {
  ALLOW: 'allow',
  CHALLENGE: 'challenge',
  DENY: 'deny',
} as const;

export const RISK_DECISION_VALUES = Object.values(RISK_DECISION);

export type RiskDecision = typeof RISK_DECISION[keyof typeof RISK_DECISION];
