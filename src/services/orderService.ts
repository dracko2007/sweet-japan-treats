/**
 * Order Management Service
 * Gerencia pedidos - lê do Firestore com fallback para localStorage
 */

import { firebaseSyncService } from '@/services/firebaseSyncService';

export interface OrderStatus {
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  updatedAt: string;
  updatedBy?: string;
}

const getLocalOrders = (): any[] => {
  const users = JSON.parse(localStorage.getItem('sweet-japan-users') || '{}');
  const allOrders: any[] = [];

  Object.keys(users).forEach((email) => {
    const user = users[email];
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

  return allOrders.sort((a, b) =>
    new Date(b.orderDate || b.date).getTime() - new Date(a.orderDate || a.date).getTime()
  );
};

export const orderService = {
  // Get all orders from localStorage (sync, for backward compat)
  getAllOrders: (): any[] => {
    return getLocalOrders();
  },

  // Async version that fetches from Firestore + merges with localStorage
  getAllOrdersAsync: async (): Promise<any[]> => {
    try {
      const firestoreOrders = await firebaseSyncService.getAllOrdersFromFirestore();
      const localOrders = getLocalOrders();

      // Merge: Firestore orders take priority, add local-only orders
      const orderMap = new Map<string, any>();

      firestoreOrders.forEach((order: any) => {
        const key = order.orderNumber || order.id;
        orderMap.set(key, {
          ...order,
          orderDate: order.orderDate || order.date || order.syncedAt,
          totalPrice: order.totalPrice || order.totalAmount || 0,
        });
      });

      localOrders.forEach((order: any) => {
        const key = order.orderNumber || order.id;
        if (!orderMap.has(key)) {
          orderMap.set(key, order);
        }
      });

      return Array.from(orderMap.values()).sort((a, b) =>
        new Date(b.orderDate || b.date).getTime() - new Date(a.orderDate || a.date).getTime()
      );
    } catch (error) {
      console.error('❌ [ORDER SERVICE] Firestore fetch failed, using localStorage:', error);
      return getLocalOrders();
    }
  },

  // Update order status (both Firestore and localStorage)
  updateOrderStatus: async (orderNumber: string, status: OrderStatus['status']): Promise<boolean> => {
    let updated = false;

    // Update in Firestore
    try {
      await firebaseSyncService.updateOrderStatus(orderNumber, status);
      updated = true;
    } catch (err) {
      console.error('❌ [ORDER] Firestore status update failed:', err);
    }

    // Also update in localStorage
    const users = JSON.parse(localStorage.getItem('sweet-japan-users') || '{}');
    Object.keys(users).forEach((email) => {
      const user = users[email];
      if (user.orders && user.orders.length > 0) {
        user.orders.forEach((order: any, orderIndex: number) => {
          if (order.orderNumber === orderNumber) {
            users[email].orders[orderIndex].status = status;
            users[email].orders[orderIndex].updatedAt = new Date().toISOString();
            updated = true;
          }
        });
      }
    });
    localStorage.setItem('sweet-japan-users', JSON.stringify(users));
    return updated;
  },

  // Delete/Cancel order
  deleteOrder: async (orderNumber: string): Promise<boolean> => {
    let deleted = false;

    const users = JSON.parse(localStorage.getItem('sweet-japan-users') || '{}');
    Object.keys(users).forEach((email) => {
      const user = users[email];
      if (user.orders && user.orders.length > 0) {
        const orderIndex = user.orders.findIndex((order: any) =>
          order.orderNumber === orderNumber
        );
        if (orderIndex !== -1) {
          users[email].orders.splice(orderIndex, 1);
          deleted = true;
        }
      }
    });
    if (deleted) {
      localStorage.setItem('sweet-japan-users', JSON.stringify(users));
    }

    try {
      await firebaseSyncService.updateOrderStatus(orderNumber, 'cancelled');
    } catch (err) {
      console.error('❌ [ORDER] Firestore delete failed:', err);
    }

    return deleted;
  },

  // Get order by number
  getOrderByNumber: (orderNumber: string): any | null => {
    const allOrders = orderService.getAllOrders();
    return allOrders.find(order => order.orderNumber === orderNumber) || null;
  },

  // Get statistics (accepts pre-loaded orders)
  getStatistics: (orders?: any[]) => {
    const allOrders = orders || orderService.getAllOrders();
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const ordersThisMonth = allOrders.filter(o =>
      new Date(o.orderDate || o.date) >= thisMonth && o.status !== 'cancelled'
    );
    const ordersLastMonth = allOrders.filter(o =>
      new Date(o.orderDate || o.date) >= lastMonth &&
      new Date(o.orderDate || o.date) < thisMonth &&
      o.status !== 'cancelled'
    );

    const totalRevenue = allOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);
    const revenueThisMonth = ordersThisMonth
      .reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);
    const revenueLastMonth = ordersLastMonth
      .reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);

    return {
      totalOrders: allOrders.filter(o => o.status !== 'cancelled').length,
      totalRevenue,
      ordersThisMonth: ordersThisMonth.length,
      revenueThisMonth,
      ordersLastMonth: ordersLastMonth.length,
      revenueLastMonth,
      pendingOrders: allOrders.filter(o => o.status === 'pending').length,
      shippedOrders: allOrders.filter(o => o.status === 'shipped').length,
      deliveredOrders: allOrders.filter(o => o.status === 'delivered').length,
      cancelledOrders: allOrders.filter(o => o.status === 'cancelled').length,
    };
  },

  // Get monthly data for charts (accepts pre-loaded orders)
  getMonthlyData: (months: number = 6, orders?: any[]) => {
    const allOrders = orders || orderService.getAllOrders();
    const data = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthOrders = allOrders.filter(o =>
        new Date(o.orderDate || o.date) >= month &&
        new Date(o.orderDate || o.date) < nextMonth &&
        o.status !== 'cancelled'
      );

      const revenue = monthOrders.reduce((sum, o) => sum + (o.totalPrice || o.totalAmount || 0), 0);

      data.push({
        month: month.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        orders: monthOrders.length,
        revenue,
      });
    }

    return data;
  }
};
