/**
 * Order Management Service
 * Gerencia pedidos no localStorage de todos os usuários
 */

export interface OrderStatus {
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  updatedAt: string;
  updatedBy?: string;
}

export const orderService = {
  // Get all orders from all users
  getAllOrders: (): any[] => {
    const users = JSON.parse(localStorage.getItem('sweet-japan-users') || '[]');
    const allOrders: any[] = [];

    users.forEach((user: any) => {
      if (user.orders && user.orders.length > 0) {
        user.orders.forEach((order: any) => {
          allOrders.push({
            ...order,
            customerEmail: user.email,
            customerName: user.name,
          });
        });
      }
    });

    // Sort by date (newest first)
    return allOrders.sort((a, b) => 
      new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
  },

  // Update order status
  updateOrderStatus: (orderNumber: string, status: OrderStatus['status']): boolean => {
    const users = JSON.parse(localStorage.getItem('sweet-japan-users') || '[]');
    let updated = false;

    users.forEach((user: any, userIndex: number) => {
      if (user.orders && user.orders.length > 0) {
        user.orders.forEach((order: any, orderIndex: number) => {
          if (order.orderNumber === orderNumber) {
            users[userIndex].orders[orderIndex].status = status;
            users[userIndex].orders[orderIndex].updatedAt = new Date().toISOString();
            updated = true;
          }
        });
      }
    });

    if (updated) {
      localStorage.setItem('sweet-japan-users', JSON.stringify(users));
    }

    return updated;
  },

  // Delete/Cancel order
  deleteOrder: (orderNumber: string): boolean => {
    const users = JSON.parse(localStorage.getItem('sweet-japan-users') || '[]');
    let deleted = false;

    users.forEach((user: any, userIndex: number) => {
      if (user.orders && user.orders.length > 0) {
        const orderIndex = user.orders.findIndex((order: any) => 
          order.orderNumber === orderNumber
        );
        
        if (orderIndex !== -1) {
          users[userIndex].orders.splice(orderIndex, 1);
          deleted = true;
        }
      }
    });

    if (deleted) {
      localStorage.setItem('sweet-japan-users', JSON.stringify(users));
    }

    return deleted;
  },

  // Get order by number
  getOrderByNumber: (orderNumber: string): any | null => {
    const allOrders = orderService.getAllOrders();
    return allOrders.find(order => order.orderNumber === orderNumber) || null;
  },

  // Get statistics
  getStatistics: () => {
    const orders = orderService.getAllOrders();
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const ordersThisMonth = orders.filter(o => 
      new Date(o.orderDate) >= thisMonth && o.status !== 'cancelled'
    );
    
    const ordersLastMonth = orders.filter(o => 
      new Date(o.orderDate) >= lastMonth && 
      new Date(o.orderDate) < thisMonth && 
      o.status !== 'cancelled'
    );

    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const revenueThisMonth = ordersThisMonth
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const revenueLastMonth = ordersLastMonth
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    return {
      totalOrders: orders.filter(o => o.status !== 'cancelled').length,
      totalRevenue,
      ordersThisMonth: ordersThisMonth.length,
      revenueThisMonth,
      ordersLastMonth: ordersLastMonth.length,
      revenueLastMonth,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      shippedOrders: orders.filter(o => o.status === 'shipped').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
    };
  },

  // Get monthly data for charts
  getMonthlyData: (months: number = 6) => {
    const orders = orderService.getAllOrders();
    const data = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthOrders = orders.filter(o => 
        new Date(o.orderDate) >= month && 
        new Date(o.orderDate) < nextMonth &&
        o.status !== 'cancelled'
      );

      const revenue = monthOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      data.push({
        month: month.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        orders: monthOrders.length,
        revenue,
      });
    }

    return data;
  }
};
