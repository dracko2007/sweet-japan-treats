// Serviço para gerenciar dados de clientes e estatísticas

export interface CustomerStats {
  email: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
  favoriteProducts: Array<{
    name: string;
    quantity: number;
    total: number;
  }>;
  orderHistory: Array<{
    orderNumber: string;
    date: string;
    total: number;
    status: string;
  }>;
}

export const customerService = {
  // Obtém todos os clientes com suas estatísticas
  getAllCustomers(): CustomerStats[] {
    const usersData = localStorage.getItem('sweet-japan-users');
    if (!usersData) return [];

    const users = JSON.parse(usersData);
    const customers: CustomerStats[] = [];

    // Itera sobre cada usuário
    Object.keys(users).forEach(email => {
      const user = users[email];
      const orders = user.orders || [];

      if (orders.length === 0) {
        // Cliente sem pedidos
        customers.push({
          email,
          name: user.name || 'N/A',
          phone: user.phone || 'N/A',
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          lastOrderDate: null,
          favoriteProducts: [],
          orderHistory: [],
        });
        return;
      }

      // Calcula totais
      let totalSpent = 0;
      const productMap: Record<string, { quantity: number; total: number }> = {};
      const orderHistory: Array<{ orderNumber: string; date: string; total: number; status: string }> = [];

      orders.forEach((order: any) => {
        totalSpent += order.total;

        orderHistory.push({
          orderNumber: order.orderNumber,
          date: order.date,
          total: order.total,
          status: order.status || 'pending',
        });

        // Conta produtos
        order.items.forEach((item: any) => {
          if (!productMap[item.name]) {
            productMap[item.name] = { quantity: 0, total: 0 };
          }
          productMap[item.name].quantity += item.quantity;
          productMap[item.name].total += item.price * item.quantity;
        });
      });

      // Ordena produtos por quantidade
      const favoriteProducts = Object.entries(productMap)
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          total: data.total,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5); // Top 5 produtos

      // Ordena pedidos por data (mais recente primeiro)
      orderHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      customers.push({
        email,
        name: user.name || 'N/A',
        phone: user.phone || 'N/A',
        totalOrders: orders.length,
        totalSpent,
        averageOrderValue: totalSpent / orders.length,
        lastOrderDate: orderHistory[0]?.date || null,
        favoriteProducts,
        orderHistory,
      });
    });

    // Ordena por total gasto (maiores clientes primeiro)
    return customers.sort((a, b) => b.totalSpent - a.totalSpent);
  },

  // Obtém estatísticas gerais de clientes
  getCustomerOverview() {
    const customers = this.getAllCustomers();
    
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.totalOrders > 0).length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
    const averageOrdersPerCustomer = activeCustomers > 0 ? totalOrders / activeCustomers : 0;
    const averageRevenuePerCustomer = activeCustomers > 0 ? totalRevenue / activeCustomers : 0;

    // Top clientes (Top 10)
    const topCustomers = customers
      .filter(c => c.totalOrders > 0)
      .slice(0, 10);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers: totalCustomers - activeCustomers,
      totalRevenue,
      totalOrders,
      averageOrdersPerCustomer,
      averageRevenuePerCustomer,
      topCustomers,
    };
  },

  // Busca cliente por email
  getCustomerByEmail(email: string): CustomerStats | null {
    const customers = this.getAllCustomers();
    return customers.find(c => c.email === email) || null;
  },
};
