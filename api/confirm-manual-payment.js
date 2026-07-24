import { requireAdmin } from './_lib/auth.js';
import { adminDb } from './_lib/firebase-admin.js';
import { fulfillOrder } from './_lib/fulfillment.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  optionalText,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { buildOrderEmail, sendMail } from './_lib/mailer.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(req, { scope: 'confirm-manual-payment', limit: 100, windowMs: 60 * 60 * 1000, identity: admin.uid });
    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['orderId', 'reference']);
    const orderId = requiredText(body.orderId, { max: 80, pattern: /^[A-Za-z0-9_-]+$/ });
    const suppliedReference = optionalText(body.reference, { max: 120 });
    const orderRef = adminDb().collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) throw new HttpError(404, 'order_not_found');
    const order = { id: snap.id, ...snap.data() };
    if (order.paymentMethod === 'card') throw new HttpError(409, 'stripe_orders_require_webhook');
    const reference = suppliedReference || `${order.paymentMethod}:${orderId}`;
    const result = await fulfillOrder(orderId, {
      provider: 'manual',
      reference,
      confirmedBy: String(admin.email || admin.uid),
    });

    if (!result.replay) {
      const refreshed = await orderRef.get();
      const fulfilled = { id: refreshed.id, ...refreshed.data() };
      await sendMail({ to: fulfilled.customerEmail, ...buildOrderEmail(fulfilled) }).catch(() => undefined);
      const storeEmail = process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
      if (storeEmail) await sendMail({ to: storeEmail, ...buildOrderEmail(fulfilled, { store: true }) }).catch(() => undefined);
    }
    res.status(200).json({ ok: true, replay: result.replay });
  } catch (error) {
    console.error('[confirm-manual-payment]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
