export const PROMO_TYPES = [
  { value: 'abertura',   label: '🎉 Promoção de Abertura' },
  { value: 'mes',        label: '📅 Promoção do Mês' },
  { value: 'lancamento', label: '🚀 Promoção de Lançamento' },
  { value: 'temporada',  label: '🌸 Promoção de Temporada' },
  { value: 'relampago',  label: '⚡ Promoção Relâmpago' },
  { value: 'especial',   label: '⭐ Promoção Especial' },
  { value: 'exclusiva',  label: '💎 Exclusiva Online' },
  { value: 'frete',      label: '🚚 Frete Grátis' },
];

export interface ScheduledNextPromo {
  type: string;
  productId: string;
  productName: string;
  productImage: string;
  originalPriceYen: number;
  promoPriceYen: number;
  discountPct: number;
  limitPerPerson: number;
  durationDays: number | null;
}

export interface ActivePromo {
  type: string;
  productId: string;
  productName: string;
  productImage: string;
  originalPriceYen: number;
  promoPriceYen: number;
  discountPct: number;
  limitPerPerson: number;
  expiresAt: number | null;
  nextPromo: ScheduledNextPromo | null;
  limitResetAt?: number; // timestamp — invalida contadores locais anteriores a este valor
}
