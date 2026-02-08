// Serviço para gerenciar dados de clientes e estatísticas
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

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
        totalSpent += order.totalPrice || 0;

        orderHistory.push({
          orderNumber: order.orderNumber,
          date: order.date,
          total: order.totalPrice || 0,
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

  // Async version: fetches all users from Firestore + merges with localStorage
  async getAllCustomersAsync(): Promise<CustomerStats[]> {
    try {
      if (!db) throw new Error('Firestore not available');
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const localCustomers = this.getAllCustomers();
      const customerMap = new Map<string, any>();

      // Add Firestore users
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const email = data.email || doc.id;
        const orders = data.orders || [];

        let totalSpent = 0;
        const orderHistory: any[] = [];
        const productMap: Record<string, { quantity: number; total: number }> = {};

        orders.forEach((order: any) => {
          totalSpent += order.totalPrice || order.totalAmount || 0;
          orderHistory.push({
            orderNumber: order.orderNumber,
            date: order.date || order.orderDate,
            total: order.totalPrice || order.totalAmount || 0,
            status: order.status || 'pending',
          });
          if (order.items) {
            order.items.forEach((item: any) => {
              const name = item.name || item.productName;
              if (!productMap[name]) productMap[name] = { quantity: 0, total: 0 };
              productMap[name].quantity += item.quantity;
              productMap[name].total += (item.price || 0) * item.quantity;
            });
          }
        });

        const favoriteProducts = Object.entries(productMap)
          .map(([name, d]) => ({ name, quantity: d.quantity, total: d.total }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        orderHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        customerMap.set(email, {
          email,
          name: data.name || 'N/A',
          phone: data.phone || 'N/A',
          totalOrders: orders.length,
          totalSpent,
          averageOrderValue: orders.length > 0 ? totalSpent / orders.length : 0,
          lastOrderDate: orderHistory[0]?.date || null,
          favoriteProducts,
          orderHistory,
        });
      });

      // Also check Firestore orders collection for orders linked to users
      try {
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        ordersSnapshot.forEach((doc) => {
          const order = doc.data();
          const email = order.customerEmail;
          if (email && customerMap.has(email)) {
            const customer = customerMap.get(email);
            const existingOrder = customer.orderHistory.find((o: any) => o.orderNumber === order.orderNumber);
            if (!existingOrder) {
              customer.totalOrders += 1;
              customer.totalSpent += order.totalPrice || order.totalAmount || 0;
              customer.orderHistory.push({
                orderNumber: order.orderNumber || doc.id,
                date: order.orderDate || order.date || order.syncedAt,
                total: order.totalPrice || order.totalAmount || 0,
                status: order.status || 'pending',
              });
              customer.averageOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;
              customer.orderHistory.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
              customer.lastOrderDate = customer.orderHistory[0]?.date || null;
            }
          }
        });
      } catch (err) {
        console.warn('⚠️ [CUSTOMER] Could not fetch orders collection:', err);
      }

      // Add local-only customers not in Firestore
      localCustomers.forEach(c => {
        if (!customerMap.has(c.email)) {
          customerMap.set(c.email, c);
        }
      });

      return Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    } catch (error) {
      console.error('❌ [CUSTOMER SERVICE] Firestore fetch failed, using localStorage:', error);
      return this.getAllCustomers();
    }
  },

  // Async customer overview
  async getCustomerOverviewAsync(): Promise<any> {
    const customers = await this.getAllCustomersAsync();
    
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.totalOrders > 0).length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
    const averageOrdersPerCustomer = activeCustomers > 0 ? totalOrders / activeCustomers : 0;
    const averageRevenuePerCustomer = activeCustomers > 0 ? totalRevenue / activeCustomers : 0;

    const topCustomers = customers.filter(c => c.totalOrders > 0).slice(0, 10);

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
};
