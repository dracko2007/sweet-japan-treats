import { Product } from '@/types';

// Nome/descrição do produto no idioma do cliente (pt/en/ja), com fallback para pt.
// Retorna undefined se o produto não tiver tradução salva (aí usa o dicionário/base).
export const i18nName = (p: Product, lang: string): string | undefined =>
  p.i18n?.[lang]?.name || p.i18n?.pt?.name;

export const i18nDesc = (p: Product, lang: string): string | undefined =>
  p.i18n?.[lang]?.description || p.i18n?.pt?.description;
