import { Product } from '@/types';

/** Promoção ativa? (desconto entre 1 e 99%) */
export const hasDiscount = (product: Pick<Product, 'discountPercent'>): boolean => {
  const d = product.discountPercent || 0;
  return d > 0 && d < 100;
};

/** Preço base em ¥ (sem desconto) para o tamanho. */
export const baseYen = (product: Product, size: 'small' | 'large'): number =>
  size === 'small' ? product.prices.small : product.prices.large;

/** Preço efetivo em ¥ já com o desconto promocional aplicado (arredondado). */
export const effectiveYen = (product: Product, size: 'small' | 'large'): number => {
  const base = baseYen(product, size);
  if (!hasDiscount(product)) return base;
  return Math.round(base * (1 - (product.discountPercent as number) / 100));
};
