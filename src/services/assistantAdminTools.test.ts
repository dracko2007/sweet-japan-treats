import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types';
import { runAdminTool } from './assistantAdminTools';

const product = (over: Partial<Product>): Product => ({
  id: 'p', name: 'Produto', description: '', category: 'cosmeticos', prices: { small: 2000, large: 0 }, image: '', flavor: '', ...over,
} as Product);

const products = [
  product({ id: 'alta', name: 'Fino Mask', prices: { small: 2000, large: 0 }, cost: 800, stock: { unlimited: false, quantity: 2 } }),
  product({ id: 'baixa', name: 'Anessa Serum', prices: { small: 2000, large: 0 }, cost: 1800, stock: { unlimited: false, quantity: 0 } }),
  product({ id: 'promo', name: 'Biore UV', prices: { small: 2000, large: 0 }, cost: 1000, discountPercent: 10, hidden: true }),
  product({ id: 'semcusto', name: 'KitKat', prices: { small: 600, large: 0 } }),
];

const run = async (name: string, args: object = {}, over = {}) =>
  JSON.parse((await runAdminTool(name, JSON.stringify(args), { products, isAdmin: true, ...over })).content);

describe('assistantAdminTools', () => {
  it('só funciona em sessão de admin', async () => {
    expect((await run('estoque', {}, { isAdmin: false })).erro).toBe('somente_admin');
  });

  it('margem por produto, da maior para a menor, com desconto aplicado e ocultos incluídos', async () => {
    const out = await run('margem_produtos');
    expect(out.produtos.map((p: { id: string }) => p.id)).toEqual(['alta', 'promo', 'baixa']);
    expect(out.produtos[0]).toMatchObject({ custo: '¥ 800', margem: '60.0%' });
    // Biore com 10% off: preço ¥1.800, custo ¥1.000 → margem 44,4%.
    expect(out.produtos[1]).toMatchObject({ margem: '44.4%', oculto: true });
    expect(out.sem_custo_cadastrado).toBe(1);
    expect((await run('margem_produtos', { ordem: 'menor', limite: 1 })).produtos[0].id).toBe('baixa');
  });

  it('estoque: esgotados e baixo por padrão, com resumo', async () => {
    const out = await run('estoque');
    expect(out.esgotados.itens.map((i: { id: string }) => i.id)).toEqual(['baixa']);
    expect(out.acabando.itens.map((i: { id: string }) => i.id)).toEqual(['alta']);
    expect(out.resumo).toMatchObject({ esgotados: 1, ocultos: 1, ilimitados: 2 });
    expect((await run('estoque', { filtro: 'estoque_baixo' })).itens.map((i: { id: string }) => i.id)).toEqual(['alta']);
    expect((await run('estoque', { filtro: 'ocultos' })).itens.map((i: { id: string }) => i.id)).toEqual(['promo']);
  });

  it('painel financeiro formata o balanço do /admin em ienes', async () => {
    const fetchDashboard = vi.fn(async () => ({
      stats: { totalOrders: 10, ordersThisMonth: 3, revenueThisMonth: 45000, totalRevenue: 300000 },
      finance: { receitaComFrete: 300000, custo: 120000, lucro: 90000 },
      monthlyData: [{ month: 'out/26', orders: 3, receitaComFrete: 45000, receitaSemFrete: 30000, custo: 12000, lucro: 15000 }],
      topProducts: [{ name: 'Fino Mask', count: 7 }],
    }));
    const out = await run('painel_financeiro', {}, { fetchDashboard });
    // Mês atual (último do painel) separado do acumulado desde o início.
    expect(out.este_mes).toMatchObject({ mes: 'out/26', pedidos: 3 });
    expect(out.este_mes.lucro).toMatch(/^¥ 15[.,]000$/);
    expect(out.acumulado_desde_o_inicio.lucro).toMatch(/^¥ 90[.,]000$/);
    expect(out.ultimos_6_meses[0]).toMatchObject({ mes: 'out/26', pedidos: 3 });
    expect(out.mais_vendidos).toEqual(['Fino Mask (7 un.)']);
  });

  it('painel fora do ar vira erro claro', async () => {
    const out = await run('painel_financeiro', {}, { fetchDashboard: async () => { throw new Error('500'); } });
    expect(out.erro).toBe('painel_indisponivel');
  });
});
