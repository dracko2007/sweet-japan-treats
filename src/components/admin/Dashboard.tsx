import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingBag, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { orderService } from '@/services/orderService';
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
  custo: number;
  lucro: number;
}

const Dashboard: React.FC = () => {
  const { products } = useProducts();
  const [stats, setStats] = useState<OrderStatistics | null>(null);
  const [finance, setFinance] = useState<FinanceSummary>({ receitaComFrete: 0, receitaSemFrete: 0, custo: 0, lucro: 0 });
  const [monthlyData, setMonthlyData] = useState<MonthlyFin[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; revenue: number }[]>([]);

  useEffect(() => {
    loadData();
  }, [products]);

  // Helpers: tudo convertido para IENE (¥) conforme a moeda de cada pedido
  const orderRevYen = (o: Order) => toYen(o.totalPrice || o.totalAmount || 0, o.currency);
  const orderShipYen = (o: Order) => toYen(o.shippingCost ?? o.shipping?.cost ?? 0, o.currency);
  // Custo (¥): snapshot no item, ou busca no produto atual (fallback p/ pedidos antigos)
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
    const orders: Order[] = await orderService.getAllOrdersAsync();
    const statistics = orderService.getStatistics(orders);
    const active = orders.filter((o) => o.status !== 'cancelled');

    // Totais financeiros (¥)
    let receitaComFrete = 0;
    let receitaSemFrete = 0;
    let custo = 0;
    active.forEach((o) => {
      const rev = orderRevYen(o);
      const prod = Math.max(rev - orderShipYen(o), 0);
      receitaComFrete += rev;
      receitaSemFrete += prod;
      custo += orderCostYen(o);
    });
    const lucro = receitaSemFrete - custo;

    // Receita do mês atual / anterior (¥, sem frete = base de lucro)
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const inRange = (o: Order, from: Date, to?: Date) => {
      const d = new Date(o.orderDate || o.date || 0);
      return d >= from && (!to || d < to);
    };
    const revenueThisMonth = active.filter((o) => inRange(o, thisMonth)).reduce((s, o) => s + orderRevYen(o), 0);
    const revenueLastMonth = active.filter((o) => inRange(o, lastMonth, thisMonth)).reduce((s, o) => s + orderRevYen(o), 0);

    // Série mensal (6 meses) com com/sem frete, custo e lucro
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

    // Top 5 produtos
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

    // Receita por método de pagamento (¥, com frete)
    const byMethod: Record<string, number> = {};
    active.forEach((order) => {
      const method = order.paymentMethod === 'paypay' ? 'PayPay' : 'Transferência';
      byMethod[method] = (byMethod[method] || 0) + orderRevYen(order);
    });
    const payment = Object.entries(byMethod).map(([method, revenue]) => ({ method, revenue: revenue as number }));

    // stats com receita JÁ convertida para ¥
    setStats({ ...statistics, totalRevenue: receitaComFrete, revenueThisMonth, revenueLastMonth });
    setFinance({ receitaComFrete, receitaSemFrete, custo, lucro });
    setMonthlyData(monthly);
    setTopProducts(top5);
    setPaymentMethods(payment);
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
    <div className="space-y-6">
      {/* Controle de Manutenção */}
      <MaintenanceToggle />

      {/* Pagamento Wise */}
      <WisePaymentSettings />

      {/* Reset de histórico de pedidos */}
      <ResetOrdersButton />

      {/* 6 Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Receita Total */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            {revenueGrowth !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${
                  Number(revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Number(revenueGrowth) >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(Number(revenueGrowth))}%
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-1">Receita Total</p>
          <p className="text-2xl font-bold">¥{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Este mês: ¥{stats.revenueThisMonth.toLocaleString()}
          </p>
        </div>

        {/* Total de Pedidos */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-blue-500" />
            </div>
            {ordersGrowth !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${
                  Number(ordersGrowth) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Number(ordersGrowth) >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(Number(ordersGrowth))}%
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-1">Total de Pedidos</p>
          <p className="text-2xl font-bold">{stats.totalOrders}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Este mês: {stats.ordersThisMonth} pedidos
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-500" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Ticket Médio</p>
          <p className="text-2xl font-bold">¥{avgTicket.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Receita / Total de pedidos
          </p>
        </div>

        {/* Taxa de Entrega */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Taxa de Entrega</p>
          <p className="text-2xl font-bold">{deliveryRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.deliveredOrders} de {stats.totalOrders} entregues
          </p>
        </div>

        {/* Pedidos Pendentes */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Pedidos Pendentes</p>
          <p className="text-2xl font-bold">{stats.pendingOrders}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Precisam de atenção
          </p>
        </div>

        {/* Cancelados */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">Cancelados</p>
          <p className="text-2xl font-bold">{stats.cancelledOrders}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Total cancelado
          </p>
        </div>
      </div>

      {/* Resumo Financeiro (tudo em ¥) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground mb-1">Receita c/ frete</p>
          <p className="text-xl font-bold">¥{finance.receitaComFrete.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Total recebido</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground mb-1">Receita s/ frete</p>
          <p className="text-xl font-bold text-pink-600">¥{finance.receitaSemFrete.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Só produtos (frete não é lucro)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground mb-1">Custo dos produtos</p>
          <p className="text-xl font-bold text-gray-500">¥{finance.custo.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Quanto você pagou</p>
        </div>
        <div className={`rounded-xl border p-5 ${finance.lucro >= 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/20 border-red-300'}`}>
          <p className="text-xs text-muted-foreground mb-1">Lucro estimado</p>
          <p className={`text-xl font-bold ${finance.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{finance.lucro.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Receita s/ frete − custo</p>
        </div>
      </div>

      {/* Gráfico Financeiro Mensal */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-1">Financeiro Mensal (¥)</h3>
        <p className="text-xs text-muted-foreground mb-6">Comparação receita com/sem frete, custo e lucro — tudo convertido para ienes.</p>
        <ResponsiveContainer width="100%" height={300}>
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

      {/* Dois gráficos em linha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Status */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold text-lg mb-6">Status dos Pedidos</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  label
                >
                  {statusData.map((entry: any, idx: number) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhum pedido para exibir</p>
          )}
        </div>

        {/* Receita por Método de Pagamento */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold text-lg mb-6">Receita por Método de Pagamento</h3>
          <div className="space-y-4">
            {paymentMethods.map((method) => {
              const percent = totalRevenue > 0 ? ((method.revenue / totalRevenue) * 100).toFixed(1) : '0';
              return (
                <div key={method.method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{method.method}</span>
                    <span className="text-sm font-bold">
                      ¥{method.revenue.toLocaleString()} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top 5 Produtos */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-6">Top 5 Produtos Mais Pedidos</h3>
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
                  <div
                    className="bg-primary rounded-full h-2 transition-all duration-500"
                    style={{ width: `${(product.count / maxProductCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum produto vendido ainda</p>
        )}
      </div>

      {/* Comparativo Mensal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-2">Mês Atual</p>
          <p className="text-3xl font-bold text-primary mb-1">¥{stats.revenueThisMonth.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{stats.ordersThisMonth} pedidos</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-2">Mês Anterior</p>
          <p className="text-3xl font-bold mb-1">¥{stats.revenueLastMonth.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{stats.ordersLastMonth} pedidos</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
