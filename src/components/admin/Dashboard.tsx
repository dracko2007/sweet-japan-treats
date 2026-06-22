import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingBag, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { orderService } from '@/services/orderService';
import { affiliateService } from '@/services/affiliateService';
import { getMarketingExpenses } from '@/components/admin/MarketingManager';
import { getEmployeePayments } from '@/components/admin/EmployeeManager';
import type { Order, OrderStatistics } from '@/types';
import { toYen } from '@/utils/currency';
import { useProducts } from '@/context/ProductsContext';
import MaintenanceToggle from '@/components/admin/MaintenanceToggle';
import ResetOrdersButton from '@/components/admin/ResetOrdersButton';
import WisePaymentSettings from '@/components/admin/WisePaymentSettings';

interface MonthlyFin {
  month: string;
  orders: number;
  receitaComFrete: number;
  receitaSemFrete: number;
  custo: number;
  lucro: number;
}

interface FinanceSummary {
  receitaComFrete: number;
  receitaSemFrete: number;
  receitaProduto: number;
  receitaPS: number;
  custo: number;
  lucro: number;
  comissoesYen: number;       // pendentes (a pagar)
  comissoesConfirmYen: number; // já liberadas/pagas
  marketingBRL: number;
  marketingJPY: number;
  salariosBRL: number;
  salariosJPY: number;
  descontosCupomYen: number;  // informativo apenas (não afeta lucro)
  lucroLiquido: number;
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between bg-muted/40 hover:bg-muted/70 transition-colors rounded-xl px-4 py-3 border border-border"
    >
      <span className="font-semibold text-base">{title}</span>
      {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
    </button>
  );
}

const Dashboard: React.FC = () => {
  const { products } = useProducts();
  const EMPTY_STATS: OrderStatistics = {
    totalOrders: 0, pendingOrders: 0, shippedOrders: 0, deliveredOrders: 0,
    cancelledOrders: 0, totalRevenue: 0, revenueThisMonth: 0, revenueLastMonth: 0,
    ordersThisMonth: 0, ordersLastMonth: 0,
  };
  const [stats, setStats] = useState<OrderStatistics | null>(null);
  const [finance, setFinance] = useState<FinanceSummary>({ receitaComFrete: 0, receitaSemFrete: 0, receitaProduto: 0, receitaPS: 0, custo: 0, lucro: 0, comissoesYen: 0, comissoesConfirmYen: 0, marketingBRL: 0, marketingJPY: 0, salariosBRL: 0, salariosJPY: 0, descontosCupomYen: 0, lucroLiquido: 0 });
  const [monthlyData, setMonthlyData] = useState<MonthlyFin[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; revenue: number }[]>([]);

  const [openPedidos, setOpenPedidos] = useState(true);
  const [openFinanceiro, setOpenFinanceiro] = useState(true);
  const [openGraficos, setOpenGraficos] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    loadData();
  }, [products, refreshKey]);

  // Prefere grandTotalYen (travado na taxa do momento da compra) para consistência com o que o cliente viu.
  const orderRevYen = (o: Order) =>
    (o as any).grandTotalYen || toYen(o.totalPrice || o.totalAmount || 0, o.currency);

  const orderShipYen = (o: Order) => {
    const shipBrl = o.shippingCost ?? o.shipping?.cost ?? 0;
    if ((o as any).grandTotalYen && (o.totalPrice || o.totalAmount)) {
      const impliedRate = (o as any).grandTotalYen / (o.totalPrice || o.totalAmount || 1);
      return Math.round(shipBrl * impliedRate);
    }
    return toYen(shipBrl, o.currency);
  };

  const orderPSYen = (o: Order) => (o as any).psFeeFinalYen || 0;

  const orderCostYen = (o: Order) =>
    (o.items || []).reduce((sum, it) => {
      const snap = (it as any).cost;
      const fromProduct = products.find(
        (p) => p.id === it.productId || p.name === (it.productName || it.name)
      )?.cost;
      const unitCost = snap != null ? snap : fromProduct || 0;
      return sum + unitCost * (it.quantity || 1);
    }, 0);

  const loadData = async () => {
    setRefreshing(true);
    const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);

    let orders: Order[] = [];
    try {
      orders = await withTimeout(orderService.getAllOrdersAsync(), 8_000, []);
    } catch {
      orders = [];
    }

    // Comissões de afiliados: pendentes (a pagar) + confirmadas (já pagas) — ambas são despesa real
    let comissoesYen = 0;
    let comissoesConfirmYen = 0;
    try {
      const [pending, allAffiliates] = await Promise.all([
        withTimeout(affiliateService.getPendingCommissions(), 5_000, []),
        withTimeout(affiliateService.getAll(), 5_000, []),
      ]);
      comissoesYen = pending.reduce((s, p) => s + (p.commissionYen || 0), 0);
      comissoesConfirmYen = allAffiliates.reduce((s, a) => s + (a.totalEarnings || 0), 0);
    } catch { /* ignora */ }

    // Gastos de marketing (BRL + JPY convertido)
    let marketingBRL = 0;
    let marketingJPY = 0;
    try {
      const mkt = await withTimeout(getMarketingExpenses(), 5_000, []);
      marketingBRL = mkt.filter(e => e.currency === 'BRL').reduce((s, e) => s + e.amount, 0);
      marketingJPY = mkt.filter(e => e.currency === 'JPY').reduce((s, e) => s + e.amount, 0);
    } catch { /* ignora */ }

    // Salários de funcionários
    let salariosBRL = 0;
    let salariosJPY = 0;
    try {
      const pays = await withTimeout(getEmployeePayments(), 5_000, []);
      salariosBRL = pays.filter(p => p.currency === 'BRL').reduce((s, p) => s + p.amount, 0);
      salariosJPY = pays.filter(p => p.currency === 'JPY').reduce((s, p) => s + p.amount, 0);
    } catch { /* ignora */ }

    // Descontos de cupons — informativo, não afeta lucro
    let descontosCupomYen = 0;
    try {
      const allOrds = orders.filter(o => o.status !== 'cancelled');
      descontosCupomYen = allOrds.reduce((s, o) => {
        const disc = (o as any).couponDiscount || 0;
        if (!disc) return s;
        const cur = (o as any).currency || 'BRL';
        const grandTotalYen = (o as any).grandTotalYen || 0;
        const totalBrl = o.totalPrice || o.totalAmount || 0;
        let discYen = 0;
        if (cur === 'JPY') {
          discYen = Math.round(disc);
        } else if (grandTotalYen > 0 && totalBrl > 0) {
          discYen = Math.round(disc * (grandTotalYen / totalBrl));
        } else {
          discYen = toYen(disc, cur);
        }
        return s + discYen;
      }, 0);
    } catch { /* ignora */ }

    const statistics = orderService.getStatistics(orders);
    const active = orders.filter((o) => o.status !== 'cancelled');

    let receitaComFrete = 0;
    let receitaSemFrete = 0;
    let receitaPS = 0;
    let custo = 0;
    active.forEach((o) => {
      const rev = orderRevYen(o);
      const ship = orderShipYen(o);
      const ps = orderPSYen(o);
      receitaComFrete += rev;
      receitaSemFrete += Math.max(rev - ship, 0);
      receitaPS += ps;
      custo += orderCostYen(o);
    });
    const receitaProduto = Math.max(receitaSemFrete - receitaPS, 0);
    const lucro = receitaProduto - custo;
    // Lucro Líquido: receita produto + PS − custo − afiliados (pendentes+confirmados) − marketing − salários
    const receitaTotal = receitaProduto + receitaPS;
    const YEN_PER_BRL = 28; // fallback ¥28/BRL
    const totalComissoesYen = comissoesYen + comissoesConfirmYen;
    const marketingYen = marketingJPY + Math.round(marketingBRL * YEN_PER_BRL);
    const salariosYen = salariosJPY + Math.round(salariosBRL * YEN_PER_BRL);
    const lucroLiquido = receitaTotal - custo - totalComissoesYen - marketingYen - salariosYen;

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const inRange = (o: Order, from: Date, to?: Date) => {
      const d = new Date(o.orderDate || o.date || 0);
      return d >= from && (!to || d < to);
    };
    const revenueThisMonth = active.filter((o) => inRange(o, thisMonth)).reduce((s, o) => s + orderRevYen(o), 0);
    const revenueLastMonth = active.filter((o) => inRange(o, lastMonth, thisMonth)).reduce((s, o) => s + orderRevYen(o), 0);

    const monthly: MonthlyFin[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const mOrders = active.filter((o) => inRange(o, mStart, mEnd));
      const cf = mOrders.reduce((s, o) => s + orderRevYen(o), 0);
      const sf = mOrders.reduce((s, o) => s + Math.max(orderRevYen(o) - orderShipYen(o), 0), 0);
      const ct = mOrders.reduce((s, o) => s + orderCostYen(o), 0);
      monthly.push({
        month: mStart.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        orders: mOrders.length,
        receitaComFrete: cf,
        receitaSemFrete: sf,
        custo: ct,
        lucro: sf - ct,
      });
    }

    const productCount: Record<string, number> = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        productCount[item.productName] = (productCount[item.productName] || 0) + (item.quantity || 1);
      });
    });
    const top5 = Object.entries(productCount)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const byMethod: Record<string, number> = {};
    active.forEach((order) => {
      const method = order.paymentMethod === 'paypay' ? 'PayPay'
        : order.paymentMethod === 'pix' ? 'PIX'
        : order.paymentMethod === 'wise' ? 'Wise'
        : order.paymentMethod === 'yucho' ? 'Yucho'
        : order.paymentMethod === 'card' ? 'Cartão'
        : 'Outro';
      byMethod[method] = (byMethod[method] || 0) + orderRevYen(order);
    });
    const payment = Object.entries(byMethod).map(([method, revenue]) => ({ method, revenue: revenue as number }));

    setStats({ ...statistics, totalRevenue: receitaComFrete, revenueThisMonth, revenueLastMonth });
    setFinance({ receitaComFrete, receitaSemFrete, receitaProduto, receitaPS, custo, lucro, comissoesYen, comissoesConfirmYen, marketingBRL, marketingJPY, salariosBRL, salariosJPY, descontosCupomYen, lucroLiquido });
    setMonthlyData(monthly);
    setTopProducts(top5);
    setPaymentMethods(payment);
    setRefreshing(false);
  };

  if (!stats) {
    return (
      <div className="space-y-6">
        <MaintenanceToggle />
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const revenueGrowth =
    stats.revenueLastMonth > 0
      ? ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth * 100).toFixed(1)
      : 0;

  const ordersGrowth =
    stats.ordersLastMonth > 0
      ? ((stats.ordersThisMonth - stats.ordersLastMonth) / stats.ordersLastMonth * 100).toFixed(1)
      : 0;

  const avgTicket = stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders) : 0;
  const deliveryRate =
    stats.totalOrders > 0 ? ((stats.deliveredOrders / stats.totalOrders) * 100).toFixed(1) : 0;
  const totalRevenue = paymentMethods.reduce((sum, p) => sum + p.revenue, 0);

  const statusData = [
    { name: 'Pendentes', value: stats.pendingOrders, color: '#f59e0b' },
    { name: 'Enviados', value: stats.shippedOrders, color: '#8b5cf6' },
    { name: 'Entregues', value: stats.deliveredOrders, color: '#22c55e' },
    { name: 'Cancelados', value: stats.cancelledOrders, color: '#ef4444' },
  ].filter(s => s.value > 0);

  const maxProductCount = Math.max(...topProducts.map(p => p.count), 1);

  return (
    <div className="space-y-4">

      {/* ── Configurações ── */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SectionHeader title="⚙️ Configurações" open={openConfig} onToggle={() => setOpenConfig(v => !v)} />
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 whitespace-nowrap px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted/70"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      {openConfig && (
        <div className="space-y-4">
          <MaintenanceToggle />
          <WisePaymentSettings />
          <ResetOrdersButton />
        </div>
      )}

      {/* ── Pedidos ── */}
      <SectionHeader title="📦 Pedidos" open={openPedidos} onToggle={() => setOpenPedidos(v => !v)} />
      {openPedidos && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-blue-500" />
                </div>
                {ordersGrowth !== 0 && (
                  <span className={`text-xs font-semibold ${Number(ordersGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(ordersGrowth) >= 0 ? '▲' : '▼'} {Math.abs(Number(ordersGrowth))}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">Total de Pedidos</p>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Este mês: {stats.ordersThisMonth}</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-yellow-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Aguardando ação</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">Taxa de Entrega</p>
              <p className="text-2xl font-bold">{deliveryRate}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">{stats.deliveredOrders} de {stats.totalOrders} entregues</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">Enviados</p>
              <p className="text-2xl font-bold text-purple-600">{stats.shippedOrders}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Em trânsito</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">Cancelados</p>
              <p className="text-2xl font-bold">{stats.cancelledOrders}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Total cancelado</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mb-0.5">Ticket Médio</p>
              <p className="text-2xl font-bold">¥{avgTicket.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Receita / pedidos</p>
            </div>
          </div>

          {/* Comparativo mensal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground mb-2">Mês Atual</p>
              <p className="text-2xl font-bold text-primary">¥{stats.revenueThisMonth.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stats.ordersThisMonth} pedidos</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground mb-2">Mês Anterior</p>
              <p className="text-2xl font-bold">¥{stats.revenueLastMonth.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stats.ordersLastMonth} pedidos</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Financeiro ── */}
      <SectionHeader title="💰 Financeiro" open={openFinanceiro} onToggle={() => setOpenFinanceiro(v => !v)} />
      {openFinanceiro && (
        <div className="space-y-4">
          {/* Receita Total */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              {revenueGrowth !== 0 && (
                <span className={`text-xs font-semibold ${Number(revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(revenueGrowth) >= 0 ? '▲' : '▼'} {Math.abs(Number(revenueGrowth))}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-0.5">Receita Total (c/ frete)</p>
            <p className="text-2xl font-bold">¥{finance.receitaComFrete.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Este mês: ¥{stats.revenueThisMonth.toLocaleString()}</p>
          </div>

          {/* Breakdown: Produto vs PS vs Frete */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-pink-50 dark:bg-pink-950/20 rounded-xl border border-pink-200 dark:border-pink-800 p-4">
              <p className="text-xs font-semibold text-pink-700 dark:text-pink-400 mb-1">🛒 Receita Produto</p>
              <p className="text-xl font-bold text-pink-700 dark:text-pink-300">¥{finance.receitaProduto.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">S/ frete e s/ PS</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">🛍️ Taxa Personal Shopper</p>
              <p className="text-xl font-bold text-orange-700 dark:text-orange-300">¥{finance.receitaPS.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">¥1.000/item</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">🚚 Frete</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">¥{Math.max(finance.receitaComFrete - finance.receitaSemFrete, 0).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Não é lucro</p>
            </div>
          </div>

          {/* Custo, Lucro Bruto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Custo dos Produtos</p>
              <p className="text-xl font-bold text-gray-500">¥{finance.custo.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Quanto você pagou</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Lucro Bruto</p>
              <p className={`text-xl font-bold ${finance.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>¥{finance.lucro.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Produto − custo</p>
            </div>
          </div>

          {/* Despesas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Comissões Afiliados</p>
              <p className="text-xl font-bold text-orange-500">−¥{(finance.comissoesYen + finance.comissoesConfirmYen).toLocaleString()}</p>
              <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                {finance.comissoesConfirmYen > 0 && <p>Liberadas: ¥{finance.comissoesConfirmYen.toLocaleString()}</p>}
                {finance.comissoesYen > 0 && <p>A liberar: ¥{finance.comissoesYen.toLocaleString()}</p>}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Marketing</p>
              {finance.marketingBRL > 0 && (
                <p className="text-xl font-bold text-blue-500">−R${finance.marketingBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              )}
              {finance.marketingJPY > 0 && (
                <p className="text-xl font-bold text-blue-500">−¥{finance.marketingJPY.toLocaleString()}</p>
              )}
              {finance.marketingBRL === 0 && finance.marketingJPY === 0 && (
                <p className="text-xl font-bold text-blue-500">−R$ 0,00</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Ads + influencers</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Salários</p>
              <p className="text-xl font-bold text-red-500">
                {finance.salariosBRL > 0 && `−R$${finance.salariosBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                {finance.salariosBRL > 0 && finance.salariosJPY > 0 && ' / '}
                {finance.salariosJPY > 0 && `−¥${finance.salariosJPY.toLocaleString()}`}
                {finance.salariosBRL === 0 && finance.salariosJPY === 0 && '¥0'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Funcionários</p>
            </div>
          </div>

          {/* Cupons — informativo */}
          {finance.descontosCupomYen > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">🏷️ Descontos Concedidos (cupons) — informativo</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">≈¥{finance.descontosCupomYen.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Receita que deixou de entrar por cupons. Não afeta o lucro líquido.</p>
            </div>
          )}

          {/* Lucro Líquido */}
          {(() => {
            const YEN_PER_BRL = 28;
            const totalComissoesYen = finance.comissoesYen + finance.comissoesConfirmYen;
            const marketingYen = finance.marketingJPY + Math.round(finance.marketingBRL * YEN_PER_BRL);
            const salariosYen = finance.salariosJPY + Math.round(finance.salariosBRL * YEN_PER_BRL);
            return (
              <div className={`rounded-xl border-2 p-5 ${finance.lucroLiquido >= 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-400 dark:border-green-700' : 'bg-red-50 dark:bg-red-950/20 border-red-400'}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">💵 Lucro Líquido</p>
                    <p className={`text-3xl font-bold ${finance.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ¥{finance.lucroLiquido.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      (Produto + PS) − Custo − Afiliados − Marketing − Salários
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>Produto: <span className="font-semibold text-foreground">+¥{finance.receitaProduto.toLocaleString()}</span></p>
                    <p>PS: <span className="font-semibold text-foreground">+¥{finance.receitaPS.toLocaleString()}</span></p>
                    <p>Custo: <span className="font-semibold text-foreground">−¥{finance.custo.toLocaleString()}</span></p>
                    <p>Afiliados: <span className="font-semibold text-foreground">−¥{totalComissoesYen.toLocaleString()}</span></p>
                    <p>Marketing: <span className="font-semibold text-foreground">−¥{marketingYen.toLocaleString()}</span></p>
                    <p>Salários: <span className="font-semibold text-foreground">−¥{salariosYen.toLocaleString()}</span></p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Gráficos & Rankings ── */}
      <SectionHeader title="📊 Gráficos & Rankings" open={openGraficos} onToggle={() => setOpenGraficos(v => !v)} />
      {openGraficos && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-1">Financeiro Mensal (¥)</h3>
            <p className="text-xs text-muted-foreground mb-6">Comparação receita com/sem frete, custo e lucro.</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => (typeof value === 'number' ? `¥${value.toLocaleString()}` : value)} />
                <Legend />
                <Bar dataKey="receitaComFrete" name="Receita c/ frete" fill="#fbcfe8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="receitaSemFrete" name="Receita s/ frete" fill="#ec4899" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custo" name="Custo" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-lg mb-6">Status dos Pedidos</h3>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} label>
                      {statusData.map((entry: any, idx: number) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum pedido</p>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-lg mb-6">Receita por Pagamento</h3>
              <div className="space-y-4">
                {paymentMethods.map((method) => {
                  const percent = totalRevenue > 0 ? ((method.revenue / totalRevenue) * 100).toFixed(1) : '0';
                  return (
                    <div key={method.method}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{method.method}</span>
                        <span className="text-sm font-bold">¥{method.revenue.toLocaleString()} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-6">Top 5 Produtos</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((product, idx) => (
                  <div key={product.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-primary w-6">#{idx + 1}</span>
                        <span className="text-sm font-medium">{product.name}</span>
                      </div>
                      <span className="text-sm font-bold">{product.count} pedido(s)</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${(product.count / maxProductCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum produto vendido ainda</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
