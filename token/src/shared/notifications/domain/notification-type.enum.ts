export const NotificationType = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  PASSWORD_CREATED:       'PASSWORD_CREATED',
  DEVICE_LINKED:          'DEVICE_LINKED',
  PASSWORD_RESET:         'PASSWORD_RESET',
  ACCESS_BLOCKED:         'ACCESS_BLOCKED',
  BIOMETRIC_ANDROID:      'BIOMETRIC_ANDROID',
  BIOMETRIC_IOS:          'BIOMETRIC_IOS',

  // ─── Transfers ─────────────────────────────────────────────────────────────
  TRANSFER_OWN_ACCOUNTS:  'TRANSFER_OWN_ACCOUNTS',

  // ─── Profile ───────────────────────────────────────────────────────────────
  EMAIL_UPDATED:          'EMAIL_UPDATED',
  PHONE_UPDATED:          'PHONE_UPDATED',
  PASSWORD_CHANGED:       'PASSWORD_CHANGED',
  TRANSFER_LIMIT_UPDATED: 'TRANSFER_LIMIT_UPDATED',

  // ─── Enriched (handler con lógica interna) ─────────────────────────────────
  STATEMENT_PDF:          'STATEMENT_PDF',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];