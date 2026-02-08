import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingBag, CheckCircle } from 'lucide-react';
import { orderService } from '@/services/orderService';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const orders = await orderService.getAllOrdersAsync();
    const statistics = orderService.getStatistics(orders);
    const monthly = orderService.getMonthlyData(6, orders);
    setStats(statistics);
    setMonthlyData(monthly);
  };

  if (!stats) {
    return <div>Carregando...</div>;
  }

  const revenueGrowth = stats.revenueLastMonth > 0
    ? ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth * 100).toFixed(1)
    : 0;

  const ordersGrowth = stats.ordersLastMonth > 0
    ? ((stats.ordersThisMonth - stats.ordersLastMonth) / stats.ordersLastMonth * 100).toFixed(1)
    : 0;

  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            {revenueGrowth !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                Number(revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Number(revenueGrowth) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(Number(revenueGrowth))}%
              </div>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Receita Total</p>
            <p className="text-2xl font-bold">¥{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Este mês: ¥{stats.revenueThisMonth.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-blue-500" />
            </div>
            {ordersGrowth !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                Number(ordersGrowth) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Number(ordersGrowth) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(Number(ordersGrowth))}%
              </div>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Total de Pedidos</p>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Este mês: {stats.ordersThisMonth} pedidos
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Pedidos Pendentes</p>
            <p className="text-2xl font-bold">{stats.pendingOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Precisam de atenção
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Pedidos Entregues</p>
            <p className="text-2xl font-bold">{stats.deliveredOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enviados: {stats.shippedOrders}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-6">Receita Mensal</h3>
        <div className="space-y-4">
          {monthlyData.map((data, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{data.month}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{data.orders} pedidos</span>
                  <span className="font-bold">¥{data.revenue.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all duration-500"
                  style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold text-lg mb-4">Status dos Pedidos</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm">Pendentes</span>
              </div>
              <span className="font-semibold">{stats.pendingOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-sm">Enviados</span>
              </div>
              <span className="font-semibold">{stats.shippedOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Entregues</span>
              </div>
              <span className="font-semibold">{stats.deliveredOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm">Cancelados</span>
              </div>
              <span className="font-semibold">{stats.cancelledOrders}</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold text-lg mb-4">Comparativo Mensal</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Mês Atual</p>
              <p className="text-2xl font-bold text-primary">¥{stats.revenueThisMonth.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stats.ordersThisMonth} pedidos</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Mês Anterior</p>
              <p className="text-2xl font-bold">¥{stats.revenueLastMonth.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stats.ordersLastMonth} pedidos</p>
            </div>
            {revenueGrowth !== 0 && (
              <div className={`p-3 rounded-lg ${
                Number(revenueGrowth) >= 0 
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
              }`}>
                <p className={`text-sm font-semibold ${
                  Number(revenueGrowth) >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {Number(revenueGrowth) >= 0 ? '📈' : '📉'} {Math.abs(Number(revenueGrowth))}% comparado ao mês anterior
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
