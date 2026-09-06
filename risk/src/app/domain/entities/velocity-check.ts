export const VELOCITY_CHECK = {
  OK: 'ok',
  WARNING: 'warning',
  EXCEEDED: 'exceeded',
} as const;

export type VelocityCheck = typeof VELOCITY_CHECK[keyof typeof VELOCITY_CHECK];
