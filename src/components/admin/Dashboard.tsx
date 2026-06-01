import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingBag, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { orderService } from '@/services/orderService';
import type { Order, OrderStatistics, MonthlyDataPoint } from '@/types';
import MaintenanceToggle from '@/components/admin/MaintenanceToggle';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<OrderStatistics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ method: string; revenue: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const orders: Order[] = await orderService.getAllOrdersAsync();
    const statistics = orderService.getStatistics(orders);
    const monthly = orderService.getMonthlyData(6, orders);

    // Calcula top 5 produtos
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

    // Calcula receita por método de pagamento
    const byMethod: Record<string, number> = {};
    orders.forEach((order) => {
      const method = order.paymentMethod === 'paypay' ? 'PayPay' : 'Transferência';
      const revenue = order.totalPrice || order.totalAmount || 0;
      byMethod[method] = (byMethod[method] || 0) + revenue;
    });
    const payment = Object.entries(byMethod).map(([method, revenue]) => ({
      method,
      revenue: revenue as number,
    }));

    setStats(statistics);
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

      {/* Gráfico de Receita + Pedidos por Mês */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-6">Receita e Pedidos Mensais</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value) => {
                if (typeof value === 'number') return value.toLocaleString();
                return value;
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              name="Receita (¥)"
              fill="#ec4899"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="orders"
              name="Pedidos"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            />
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
