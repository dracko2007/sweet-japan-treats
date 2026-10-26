/**
 * Ferramentas do assistente só para o administrador: balanço (o mesmo do
 * painel /admin), margem por produto e estoque. O servidor só as oferece à IA
 * quando o token da sessão é do admin (api/kimiclaw.js); aqui elas também só
 * rodam com `ctx.isAdmin`. Todo número sai pronto daqui — a IA não calcula.
 */
import type { Product } from '@/types';
import { formatPrice } from '@/utils/currency';
import { effectiveYen, getVariants } from '@/utils/pricing';
import { productEnglishName } from '@/utils/productName';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { normalize, searchCatalog, type ToolResult } from '@/services/assistantTools';

export const ADMIN_TOOL_NAMES = new Set(['painel_financeiro', 'margem_produtos', 'estoque']);

const PS_FEE_YEN = 1000;
const LOW_STOCK = 3;

export interface AdminToolContext {
  products: Product[];
  isAdmin: boolean;
  /** Injetável para teste; padrão: GET /api/admin-dashboard autenticado. */
  fetchDashboard?: () => Promise<DashboardData>;
}

interface DashboardData {
  stats?: Record<string, number>;
  finance?: Record<string, number>;
  monthlyData?: Array<{ month: string; orders: number; receitaComFrete: number; receitaSemFrete: number; custo: number; lucro: number }>;
  topProducts?: Array<{ name: string; count: number }>;
  paymentMethods?: Array<{ method: string; revenue: number }>;
}

const yen = (v: unknown) => formatPrice(Math.round(Number(v) || 0), 'JPY');
const json = (data: unknown): ToolResult => ({ content: JSON.stringify(data) });

async function defaultFetchDashboard(): Promise<DashboardData> {
  const res = await authenticatedFetch('/api/admin-dashboard');
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

async function financialPanel(ctx: AdminToolContext): Promise<ToolResult> {
  let d: DashboardData;
  try {
    d = await (ctx.fetchDashboard || defaultFetchDashboard)();
  } catch {
    return json({ ok: false, erro: 'painel_indisponivel', dica: 'Peça para abrir o painel /admin.' });
  }
  const s = d.stats || {};
  const f = d.finance || {};
  const months = d.monthlyData || [];
  // Mês a mês vem do painel (último = mês atual). O "acumulado" é desde o início
  // da loja — nomes explícitos para a IA não apresentar o total como se fosse do mês.
  const monthSummary = (m?: (typeof months)[number]) => (m ? {
    mes: m.month, pedidos: m.orders, receita_com_frete: yen(m.receitaComFrete), receita_sem_frete: yen(m.receitaSemFrete),
    custo_produtos: yen(m.custo), lucro: yen(m.lucro),
  } : undefined);
  return json({
    ok: true,
    moeda: 'JPY',
    este_mes: monthSummary(months[months.length - 1]) ?? { pedidos: s.ordersThisMonth, receita_com_frete: yen(s.revenueThisMonth) },
    mes_passado: monthSummary(months[months.length - 2]) ?? { pedidos: s.ordersLastMonth, receita_com_frete: yen(s.revenueLastMonth) },
    pedidos_por_status_agora: {
      aguardando_pagamento: s.pendingOrders, pagamento_em_analise: s.paymentReviewOrders, confirmados: s.confirmedOrders,
      enviados: s.shippedOrders, entregues: s.deliveredOrders, cancelados: s.cancelledOrders,
    },
    acumulado_desde_o_inicio: {
      pedidos: s.totalOrders,
      receita_com_frete: yen(f.receitaComFrete),
      receita_sem_frete: yen(f.receitaSemFrete),
      receita_produtos: yen(f.receitaProduto),
      receita_taxa_servico: yen(f.receitaPS),
      custo_produtos: yen(f.custo),
      lucro: yen(f.lucro),
      descontos_cupom: yen(f.descontosCupomYen),
      pontos_resgatados: yen(f.pontosResgatadosYen),
    },
    ultimos_6_meses: months.map(monthSummary),
    mais_vendidos: (d.topProducts || []).map((p) => `${p.name} (${p.count} un.)`),
    por_forma_de_pagamento: (d.paymentMethods || []).map((p) => `${p.method}: ${yen(p.revenue)}`),
  });
}

/** Margem da variante principal (a que o custo do cadastro descreve). */
function marginRow(p: Product) {
  const variant = getVariants(p)[0];
  const price = effectiveYen(p, variant?.id || 'small');
  const cost = Number(p.cost) || 0;
  if (!cost || !price) return null;
  const profit = price - cost;
  return {
    id: p.id,
    nome: productEnglishName(p),
    variante: variant?.label,
    preco_venda: yen(price),
    custo: yen(cost),
    lucro_unidade: yen(profit),
    margem: `${((profit / price) * 100).toFixed(1)}%`,
    taxa_servico_extra: p.noPsFee ? 'isento' : yen(PS_FEE_YEN),
    oculto: p.hidden || undefined,
    _margin: profit / price,
  };
}

function productMargins(ctx: AdminToolContext, args: Record<string, unknown>): ToolResult {
  const pool = args.consulta ? searchCatalog(ctx.products.map((p) => ({ ...p, hidden: false })), String(args.consulta), 30) : ctx.products;
  const rows = pool.map((p) => marginRow(ctx.products.find((x) => x.id === p.id) || p)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const asc = String(args.ordem || '').startsWith('menor');
  rows.sort((a, b) => (asc ? a._margin - b._margin : b._margin - a._margin));
  const limit = Math.max(1, Math.min(15, Number(args.limite) || 8));
  const semCusto = pool.filter((p) => !(Number(p.cost) > 0)).length;
  return json({
    ok: true,
    ordem: asc ? 'menor margem primeiro' : 'maior margem primeiro',
    produtos: rows.slice(0, limit).map(({ _margin: _m, ...r }) => r),
    total_com_custo: rows.length,
    sem_custo_cadastrado: semCusto,
    nota: 'Margem = (preço com desconto − custo) ÷ preço, da variante principal. A taxa de serviço é receita à parte.',
  });
}

function stockReport(ctx: AdminToolContext, args: Record<string, unknown>): ToolResult {
  const filter = normalize(String(args.filtro || 'atencao'));
  const pool = args.consulta ? searchCatalog(ctx.products.map((p) => ({ ...p, hidden: false })), String(args.consulta), 30)
    .map((p) => ctx.products.find((x) => x.id === p.id) || p) : ctx.products;
  const row = (p: Product) => ({
    id: p.id,
    nome: productEnglishName(p),
    estoque: !p.stock || p.stock.unlimited ? 'ilimitado' : p.stock.quantity,
    oculto: p.hidden || undefined,
  });
  const limited = pool.filter((p) => p.stock && !p.stock.unlimited);
  const soldOut = limited.filter((p) => p.stock!.quantity <= 0);
  const low = limited.filter((p) => p.stock!.quantity > 0 && p.stock!.quantity <= LOW_STOCK);
  const resumo = {
    produtos: pool.length,
    com_estoque_controlado: limited.length,
    ilimitados: pool.length - limited.length,
    esgotados: soldOut.length,
    acabando: `${low.length} (1 a ${LOW_STOCK} un.)`,
    ocultos: pool.filter((p) => p.hidden).length,
  };
  const page = (list: Product[], max = 20) => ({
    itens: list.slice(0, max).map(row),
    mais_itens: list.length > max ? list.length - max : undefined,
  });
  // Padrão: esgotados e acabando em listas separadas, para a IA não misturar.
  const named = filter.startsWith('esgot') ? soldOut
    : /^(baix|acab|estoque_?baixo)/.test(filter) ? low
      : filter.startsWith('ocult') ? pool.filter((p) => p.hidden)
        : filter.startsWith('tod') || args.consulta ? pool
          : null;
  if (named) return json({ ok: true, resumo, ...page(named) });
  return json({
    ok: true,
    resumo,
    esgotados: page(soldOut, 15),
    acabando: low.length ? page(low, 15) : 'nenhum',
  });
}

export async function runAdminTool(name: string, rawArgs: string | undefined, ctx: AdminToolContext): Promise<ToolResult> {
  if (!ctx.isAdmin) return json({ ok: false, erro: 'somente_admin' });
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return json({ ok: false, erro: 'argumentos_invalidos' });
  }
  if (name === 'painel_financeiro') return financialPanel(ctx);
  if (name === 'margem_produtos') return productMargins(ctx, args);
  if (name === 'estoque') return stockReport(ctx, args);
  return json({ ok: false, erro: 'ferramenta_desconhecida' });
}
