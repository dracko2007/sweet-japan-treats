import { safeStorage } from '@/utils/storage';
/**
 * Order Management Service
 * Gerencia pedidos - lê do Firestore com fallback para safeStorage
 */

import { firebaseSyncService } from '@/services/firebaseSyncService';
import { ensureAdminAuth } from '@/utils/adminAuth';
import type { Order, OrderStatistics, MonthlyDataPoint } from '@/types';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};

export interface OrderStatus {
  status: 'pending' | 'processing' | 'packing' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  updatedAt: string;
  updatedBy?: string;
}

const getLocalOrders = (): any[] => {
  const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
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
  // Get all orders from safeStorage (sync, for backward compat)
  getAllOrders: (): any[] => {
    return getLocalOrders();
  },

  // Async version that fetches from Firestore + merges with safeStorage
  getAllOrdersAsync: async (): Promise<Order[]> => {
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
      devError('❌ [ORDER SERVICE] Firestore fetch failed, using safeStorage:', error);
      return getLocalOrders();
    }
  },

  // Update order status (both Firestore and safeStorage)
  updateOrderStatus: async (orderNumber: string, status: OrderStatus['status']): Promise<boolean> => {
    let updated = false;

    // Update in Firestore
    try {
      await ensureAdminAuth();
      await firebaseSyncService.updateOrderStatus(orderNumber, status);
      updated = true;
    } catch (err) {
      devError('❌ [ORDER] Firestore status update failed:', err);
    }

    // Also update in safeStorage
    const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
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
    safeStorage.setItem('japan-express-users', JSON.stringify(users));
    return updated;
  },

  // Confirma pagamento do pedido (marca como recebido pelo admin)
  confirmPayment: async (orderNumber: string, adminEmail: string): Promise<boolean> => {
    let updated = false;
    const now = new Date().toISOString();

    // Update in Firestore
    try {
      await ensureAdminAuth();
      await firebaseSyncService.confirmPayment(orderNumber, adminEmail, now);
      updated = true;
    } catch (err) {
      devError('❌ [ORDER] Firestore payment confirmation failed:', err);
    }

    // Also update in safeStorage
    const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
    Object.keys(users).forEach((email) => {
      const user = users[email];
      if (user.orders && user.orders.length > 0) {
        const order = user.orders.find((o: any) => o.orderNumber === orderNumber);
        if (order) {
          order.paymentConfirmed = true;
          order.paymentConfirmedAt = now;
          order.paymentConfirmedBy = adminEmail;
          updated = true;
        }
      }
    });
    if (updated) {
      safeStorage.setItem('japan-express-users', JSON.stringify(users));
    }

    return updated;
  },

  // Exclui o pedido de verdade (localStorage + Firestore)
  deleteOrder: async (orderNumber: string): Promise<boolean> => {
    let deletedLocal = false;

    const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
    Object.keys(users).forEach((email) => {
      const user = users[email];
      if (user.orders && user.orders.length > 0) {
        const orderIndex = user.orders.findIndex((order: any) =>
          order.orderNumber === orderNumber
        );
        if (orderIndex !== -1) {
          users[email].orders.splice(orderIndex, 1);
          deletedLocal = true;
        }
      }
    });
    if (deletedLocal) {
      safeStorage.setItem('japan-express-users', JSON.stringify(users));
    }

    // Exclui de verdade no Firestore (deleteDoc), não apenas marca como cancelado
    let deletedRemote = false;
    try {
      await ensureAdminAuth();
      deletedRemote = await firebaseSyncService.deleteOrderFromFirestore(orderNumber);
    } catch (err) {
      devError('❌ [ORDER] Firestore delete failed:', err);
    }

    return deletedLocal || deletedRemote;
  },

  // RESET TOTAL: apaga TODO o histórico de pedidos (localStorage + Firestore).
  // Retorna quantos pedidos foram removidos do Firestore.
  clearAllOrders: async (): Promise<number> => {
    let firestoreDeleted = 0;

    // 1) Firestore — apaga todos os docs da coleção 'orders'
    try {
      await ensureAdminAuth();
      const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');
      if (db) {
        const snap = await getDocs(collection(db, 'orders'));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'orders', d.id));
          firestoreDeleted++;
        }
      }
    } catch (err) {
      devError('❌ [ORDER] clearAllOrders Firestore falhou:', err);
    }

    // 2) localStorage — chaves orders_*, sakura_orders e .orders de cada usuário
    try {
      safeStorage.keys().forEach((key) => {
        if (key.startsWith('orders_')) safeStorage.removeItem(key);
      });
      safeStorage.removeItem('sakura_orders');

      const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
      Object.keys(users).forEach((email) => {
        if (users[email] && Array.isArray(users[email].orders)) {
          users[email].orders = [];
        }
      });
      safeStorage.setItem('japan-express-users', JSON.stringify(users));
    } catch (err) {
      devError('❌ [ORDER] clearAllOrders localStorage falhou:', err);
    }

    return firestoreDeleted;
  },

  // Update order tracking info (both Firestore and safeStorage)
  updateOrderTracking: async (orderNumber: string, trackingNumber: string, trackingUrl: string, carrier: string): Promise<boolean> => {
    let updated = false;

    // Update in Firestore
    try {
      await ensureAdminAuth();
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');
      if (db) {
        const orderRef = doc(db, 'orders', orderNumber);
        await updateDoc(orderRef, {
          trackingNumber,
          trackingUrl,
          carrier,
          status: 'shipped',
          updatedAt: new Date().toISOString()
        });
        updated = true;
        devLog('✅ [ORDER] Tracking saved to Firestore:', orderNumber);
      }
    } catch (err) {
      devError('❌ [ORDER] Firestore tracking update failed:', err);
    }

    // Also update in safeStorage
    const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
    Object.keys(users).forEach((email) => {
      const user = users[email];
      if (user.orders && user.orders.length > 0) {
        user.orders.forEach((order: any, orderIndex: number) => {
          if (order.orderNumber === orderNumber) {
            users[email].orders[orderIndex].trackingNumber = trackingNumber;
            users[email].orders[orderIndex].trackingUrl = trackingUrl;
            users[email].orders[orderIndex].carrier = carrier;
            users[email].orders[orderIndex].status = 'shipped';
            users[email].orders[orderIndex].updatedAt = new Date().toISOString();
            updated = true;
          }
        });
      }
    });
    safeStorage.setItem('japan-express-users', JSON.stringify(users));

    // Also update per-user orders storage
    const allKeys = safeStorage.keys();
    allKeys.forEach(key => {
      if (key.startsWith('orders_')) {
        try {
          const userOrders = JSON.parse(safeStorage.getItem(key) || '[]');
          let changed = false;
          userOrders.forEach((order: any, idx: number) => {
            if (order.orderNumber === orderNumber) {
              userOrders[idx].trackingNumber = trackingNumber;
              userOrders[idx].trackingUrl = trackingUrl;
              userOrders[idx].carrier = carrier;
              userOrders[idx].status = 'shipped';
              changed = true;
            }
          });
          if (changed) safeStorage.setItem(key, JSON.stringify(userOrders));
        } catch (e) { /* ignore */ }
      }
    });

    return updated;
  },

  // Get order by number
  getOrderByNumber: (orderNumber: string): any | null => {
    const allOrders = orderService.getAllOrders();
    return allOrders.find(order => order.orderNumber === orderNumber) || null;
  },

  // Get statistics (accepts pre-loaded orders)
  getStatistics: (orders?: Order[]): OrderStatistics => {
    const allOrders: Order[] = orders || orderService.getAllOrders();
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
  getMonthlyData: (months: number = 6, orders?: Order[]): MonthlyDataPoint[] => {
    const allOrders: Order[] = orders || orderService.getAllOrders();
    const data: MonthlyDataPoint[] = [];
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
