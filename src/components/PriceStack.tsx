import React from 'react';
import { formatPriceParts } from '@/utils/currency';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  currency: string;
  className?: string;
  /** Classes extras da linha do ¥ (por padrão menor e mais apagada). */
  yenClassName?: string;
}

/**
 * Preço na moeda do cliente em cima e a referência em ¥ embaixo, menor.
 * Cada linha não quebra: em card estreito o valor não começa numa linha e
 * termina na outra.
 */
const PriceStack: React.FC<Props> = ({ value, currency, className, yenClassName }) => {
  const { main, yen } = formatPriceParts(value, currency);
  return (
    <span className={cn('inline-flex flex-col leading-tight', className)}>
      <span className="whitespace-nowrap">{main}</span>
      {yen && <span className={cn('whitespace-nowrap text-[0.68em] font-semibold opacity-70', yenClassName)}>{yen}</span>}
    </span>
  );
};

export default PriceStack;
