export const CHANNEL = {
  WEB: 'web',
  APP: 'app',
} as const;

export const CHANNEL_VALUES = Object.values(CHANNEL);

export type Channel = typeof CHANNEL[keyof typeof CHANNEL];
