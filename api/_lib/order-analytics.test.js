import { describe, expect, it } from 'vitest';
import { handleDashboard as adminDashboard, handleCouponUsage as adminCouponUsage } from '../admin.js';
import {
  buildDashboardAnalytics,
  couponRow,
  matchesCouponFilters,
  orderRevenueYen,
} from './order-analytics.js';

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

describe('order analytics', () => {
  it('uses immutable yen snapshots and excludes cancelled orders from revenue', () => {
    const orders = [
      {
        id: 'one',
        orderNumber: 'ONE',
        orderDate: '2026-07-10T00:00:00.000Z',
        status: 'delivered',
        totalYen: 1200,
        totalPrice: 20,
        currency: 'BRL',
        shippingCostYen: 2,
        psFeeYen: 50,
        couponDiscountYen: 5,
        redeemPoints: 30,
        paymentMethod: 'pix',
        items: [{ productId: 'p1', productName: 'Produto', quantity: 2 }],
      },
      {
        id: 'cancelled',
        orderDate: '2026-07-11T00:00:00.000Z',
        status: 'cancelled',
        totalYen: 9000,
        items: [],
      },
    ];
    const result = buildDashboardAnalytics(
      orders,
      [{ id: 'p1', name: 'Produto', cost: 100 }],
      new Date('2026-07-23T00:00:00.000Z'),
    );

    expect(orderRevenueYen(orders[0])).toBe(1200);
    expect(result.stats.totalOrders).toBe(1);
    expect(result.stats.cancelledOrders).toBe(1);
    expect(result.stats.totalRevenue).toBe(1200);
    expect(result.finance.custo).toBe(200);
    expect(result.finance.receitaPS).toBe(50);
    // 1200 (totalYen) - 2 (shippingCostYen) - 50 (psFeeYen) = 1148.
    expect(result.finance.receitaProduto).toBe(1148);
    expect(result.finance.descontosCupomYen).toBe(5);
    expect(result.finance.pontosResgatadosYen).toBe(30);
    expect(result.topProducts).toEqual([{ name: 'Produto', count: 2 }]);
    expect(result.paymentMethods).toEqual([{ method: 'PIX', revenue: 1200 }]);
    expect(result.monthlyData.at(-1)).toMatchObject({ orders: 1, receitaComFrete: 1200 });
  });

  it('reads totalYen as the primary revenue source and grandTotalYen only as a fallback for manual sales', () => {
    // Checkout normal (api/orders.js) sempre grava `totalYen`. Só a "venda
    // posterior" manual (src/services/orderService.ts `createManualSale`)
    // grava `grandTotalYen` sem `totalYen` — por isso o fallback existe, mas
    // não pode ter prioridade: um pedido normal fora do Japão nunca teve
    // `grandTotalYen`, então lê-lo primeiro sempre zerava a receita dele.
    expect(orderRevenueYen({ totalYen: 500, grandTotalYen: 999 })).toBe(500);
    expect(orderRevenueYen({ grandTotalYen: 999 })).toBe(999);
    expect(orderRevenueYen({})).toBe(0);
  });

  it('classifies orders into the real status lifecycle buckets', () => {
    const base = { orderDate: '2026-07-10T00:00:00.000Z', totalYen: 100, items: [] };
    const orders = [
      { ...base, id: 'a', status: 'pending_payment' },
      { ...base, id: 'b', status: 'payment_review' },
      { ...base, id: 'c', status: 'confirmed' },
      { ...base, id: 'd', status: 'processing' },
      { ...base, id: 'e', status: 'packing' },
      { ...base, id: 'f', status: 'shipped' },
      { ...base, id: 'g', status: 'delivered' },
      { ...base, id: 'h', status: 'cancelled' },
    ];
    const result = buildDashboardAnalytics(orders, [], new Date('2026-07-23T00:00:00.000Z'));

    expect(result.stats.pendingOrders).toBe(1);
    expect(result.stats.paymentReviewOrders).toBe(1);
    // 'confirmed', 'processing' e 'packing' são todos o mesmo estágio "pago,
    // em preparo" (ver comentário acima de PENDING_PAYMENT_STATUSES).
    expect(result.stats.confirmedOrders).toBe(3);
    expect(result.stats.shippedOrders).toBe(1);
    expect(result.stats.deliveredOrders).toBe(1);
    expect(result.stats.cancelledOrders).toBe(1);
    expect(result.stats.totalOrders).toBe(7); // tudo exceto o cancelado
  });

  it('builds and filters coupon rows without leaking cancelled orders', () => {
    const row = couponRow({
      id: 'order-1',
      orderDate: '2026-07-20T00:00:00.000Z',
      couponCode: 'VERAO10',
      couponDiscountYen: 100,
      currency: 'JPY',
      status: 'delivered',
    });
    expect(row).toMatchObject({ id: 'order-1', couponCode: 'VERAO10', discountYen: 100 });
    expect(matchesCouponFilters(row, 'coupon', 'verao')).toBe(true);
    expect(matchesCouponFilters(row, 'affiliate', '')).toBe(false);
    expect(couponRow({ status: 'cancelled', couponCode: 'X' })).toBeNull();
  });
});

describe('admin analytics API boundaries', () => {
  it('requires admin authentication before dashboard data access', async () => {
    const res = response();
    await adminDashboard({ method: 'GET', headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('requires admin authentication before coupon report access', async () => {
    const res = response();
    await adminCouponUsage({ method: 'GET', headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects unsupported methods before data access', async () => {
    const res = response();
    await adminDashboard({ method: 'POST', headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'method_not_allowed' });
  });
});
