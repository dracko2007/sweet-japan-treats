import { describe, expect, it } from 'vitest';
import { formatPrice, formatPriceParts, getCurrencyByCountry, toYen } from './currency';

describe('regional currency policy', () => {
  it.each([
    ['Brasil', 'BRL'],
    ['Japão', 'JPY'],
    ['Portugal', 'EUR'],
    ['França', 'EUR'],
    ['Estados Unidos', 'USD'],
    ['Outros', 'USD'],
    ['', 'USD'],
    ['País não cadastrado', 'USD'],
  ])('maps %s to %s', (country, expected) => {
    expect(getCurrencyByCountry(country)).toBe(expected);
  });

  it('converts explicit USD totals back to yen instead of treating them as JPY', () => {
    expect(toYen(10, 'USD')).toBeGreaterThan(100);
    expect(toYen(10, 'JPY')).toBe(10);
  });

  it('keeps historical totals with no currency as yen to avoid inflating legacy data', () => {
    expect(toYen(900)).toBe(900);
    expect(toYen(900, 'UNKNOWN')).toBe(900);
  });
});

describe('preço em duas partes (cards: moeda do cliente em cima, ¥ embaixo)', () => {
  it.each(['BRL', 'EUR', 'USD'])('%s: as partes juntas dão o mesmo texto de formatPrice', (currency) => {
    const { main, yen } = formatPriceParts(123, currency);
    expect(yen).toMatch(/^¥ /);
    expect(`${main} (${yen})`).toBe(formatPrice(123, currency));
  });

  it('em ienes não repete o valor, e noConvert tira a referência', () => {
    expect(formatPriceParts(3450, 'JPY')).toEqual({ main: formatPrice(3450, 'JPY'), yen: null });
    expect(formatPriceParts(145, 'BRL', true)).toEqual({ main: 'R$ 145', yen: null });
  });
});
