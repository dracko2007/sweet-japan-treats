import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/firebase', () => ({ db: null }));

import { loadProductCosts, normalizeCost, withCosts } from './productCostService';
import type { Product } from '@/types';

const product = (id: string, extra: Partial<Product> = {}) => ({ id, name: id, ...extra }) as Product;

describe('productCostService', () => {
  it('normaliza custo inválido ou negativo para 0', () => {
    expect(normalizeCost(480)).toBe(480);
    expect(normalizeCost('479.6')).toBe(480);
    expect(normalizeCost(-5)).toBe(0);
    expect(normalizeCost('abc')).toBe(0);
    expect(normalizeCost(undefined)).toBe(0);
  });

  it('junta o custo só nos produtos que têm custo cadastrado', () => {
    const costs = new Map([['a', 300]]);
    const result = withCosts([product('a'), product('b')], costs);
    expect(result[0].cost).toBe(300);
    expect(result[1]).not.toHaveProperty('cost');
  });

  it('sem custos carregados devolve a mesma lista (cliente comum)', () => {
    const list = [product('a')];
    expect(withCosts(list, null)).toBe(list);
    expect(withCosts(list, new Map())).toBe(list);
  });

  it('sem Firebase devolve mapa vazio', async () => {
    await expect(loadProductCosts()).resolves.toEqual(new Map());
  });
});
