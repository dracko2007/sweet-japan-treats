export const BRL_TO_JPY_RATE = 28;

/**
 * Formats a numeric price into a localized string based on the currency (JPY or BRL).
 */
export const formatPrice = (price: number, currency: 'BRL' | 'JPY' | string): string => {
  if (currency === 'JPY') {
    return `¥ ${Math.round(price).toLocaleString()}`;
  }
  return `R$ ${price.toFixed(2)}`;
};

/**
 * Converts a price from BRL to JPY using a fixed conversion rate.
 */
export const convertBrlToJpy = (priceInBrl: number): number => {
  return priceInBrl * BRL_TO_JPY_RATE;
};

/**
 * Converts a price from JPY to BRL using a fixed conversion rate.
 */
export const convertJpyToBrl = (priceInJpy: number): number => {
  return priceInJpy / BRL_TO_JPY_RATE;
};
