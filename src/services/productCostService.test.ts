import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/firebase', () => ({ db: null }));

import { loadProductCosts, mergeAdminProducts, normalizeCost, withCosts } from './productCostService';
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

  it('lista do admin inclui os ocultos, com custo e sem repetir', () => {
    const visible = [product('a', { cost: 100 })];
    const hidden = [product('h', { hidden: true }), product('a', { hidden: true })];
    const result = mergeAdminProducts(visible, hidden, new Map([['h', 250]]));
    expect(result.map((p) => p.id)).toEqual(['a', 'h']);
    expect(result[1]).toMatchObject({ hidden: true, cost: 250 });
  });

  it('sem ocultos devolve a lista de publicados', () => {
    const visible = [product('a')];
    expect(mergeAdminProducts(visible, [], null)).toBe(visible);
  });
});
