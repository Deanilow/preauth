export const NotificationChannel = {
  EMAIL:          'EMAIL',
  PUSH:           'PUSH',
  EMAIL_AND_PUSH: 'EMAIL_AND_PUSH',
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];