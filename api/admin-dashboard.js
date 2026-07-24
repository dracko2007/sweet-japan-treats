import { requireAdmin } from './_lib/auth.js';
import { adminDb } from './_lib/firebase-admin.js';
import { handleCors, sendError } from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';
import { buildDashboardAnalytics } from './_lib/order-analytics.js';

const ORDER_FIELDS = [
  'orderDate', 'date', 'syncedAt', 'status', 'paymentMethod', 'currency',
  'grandTotalYen', 'totalPrice', 'totalAmount', 'shippingCost', 'shipping',
  'psFeeFinalYen', 'couponDiscount', 'items',
];

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['GET'] })) return;

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(req, {
      scope: 'admin-dashboard',
      limit: 60,
      windowMs: 60 * 60 * 1000,
      identity: admin.uid,
    });

    const db = adminDb();
    // Firestore has no arbitrary GROUP BY for the product/payment breakdowns. The scan
    // remains server-side and projects only fields needed by this administrative report.
    const [ordersSnapshot, productsSnapshot] = await Promise.all([
      db.collection('orders').select(...ORDER_FIELDS).get(),
      db.collection('products').select('name', 'cost').get(),
    ]);
    const orders = ordersSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const products = productsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));

    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({ ok: true, ...buildDashboardAnalytics(orders, products) });
  } catch (error) {
    console.error('[admin-dashboard]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
