export const CURRENCY = {
  PEN: 'PEN',
  USD: 'USD'
} as const;

export const CURRENCY_VALUES = Object.values(CURRENCY);

export type Currency = typeof CURRENCY[keyof typeof CURRENCY];

export const COBIS_CURRENCY_CODE = {
  PEN: 0,
  USD: 1
} as const;

export const COBIS_CURRENCY_CODE_TO_ISO: Record<number, Currency> = {
  [COBIS_CURRENCY_CODE.PEN]: CURRENCY.PEN,
  [COBIS_CURRENCY_CODE.USD]: CURRENCY.USD
};

export const mapCobisCurrencyCodeToIso = (code: unknown): Currency => {
  return typeof code === 'number' && COBIS_CURRENCY_CODE_TO_ISO[code]
    ? COBIS_CURRENCY_CODE_TO_ISO[code]
    : CURRENCY.PEN;
};

