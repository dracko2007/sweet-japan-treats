import { describe, expect, it } from 'vitest';
import { YUPACK_PREFECTURES, yupackRateYen } from './yupack.js';
import { japanPrefectures } from '../src/data/japanPrefectures';

describe('Yu-Pack saindo de Hiroshima (tabela oficial)', () => {
  it('cobra os valores do 基本運賃表（広島）', () => {
    expect(yupackRateYen('Hiroshima', 60)).toBe(840);
    expect(yupackRateYen('Hiroshima', 80)).toBe(1150);
    expect(yupackRateYen('Osaka', 60)).toBe(970);
    expect(yupackRateYen('Kagoshima', 80)).toBe(1320);
    expect(yupackRateYen('Aichi', 60)).toBe(1090);
    expect(yupackRateYen('Tokyo', 60)).toBe(1270);
    expect(yupackRateYen('Niigata', 80)).toBe(1580);
    expect(yupackRateYen('Miyagi', 60)).toBe(1550);
    expect(yupackRateYen('Hokkaido', 80)).toBe(2240);
    expect(yupackRateYen('Okinawa', 60)).toBe(1470);
  });

  it('cobre as 47 províncias da lista do checkout', () => {
    expect(YUPACK_PREFECTURES).toHaveLength(47);
    for (const pref of japanPrefectures) expect(yupackRateYen(pref.name, 60)).toBeGreaterThan(0);
  });

  it('província desconhecida devolve null', () => {
    expect(yupackRateYen('SP', 60)).toBeNull();
  });
});
