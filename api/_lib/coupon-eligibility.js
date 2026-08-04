import { HttpError } from './http.js';

const PAID_STATUSES = new Set(['confirmed', 'processing', 'shipped', 'delivered']);
const TOKYO_MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
});

export function activeByDate(value) {
  if (!value) return true;
  const timestamp = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function paidOrder(order) {
  return order?.paymentConfirmed === true
    || order?.fulfillmentState === 'fulfilled'
    || PAID_STATUSES.has(String(order?.status || '').toLowerCase());
}

async function paidOrderCount(db, uid, email, requiredCount) {
  const limit = Math.max(1, Math.min(500, Math.floor(requiredCount) || 1));
  const queries = [];
  if (uid) queries.push(db.collection('orders').where('userId', '==', uid).limit(limit).get());
  if (email) queries.push(db.collection('orders').where('customerEmail', '==', email).limit(limit).get());
  if (queries.length === 0) return 0;

  const snapshots = await Promise.all(queries);
  const orders = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) orders.set(document.id, document.data());
  }
  let count = 0;
  for (const order of orders.values()) {
    if (paidOrder(order)) count += 1;
    if (count >= requiredCount) return count;
  }
  return count;
}

function birthMonth(value) {
  if (typeof value !== 'string') return 0;
  const match = /^(?:\d{4})-(\d{2})-(?:\d{2})(?:$|T)/.exec(value.trim());
  return match ? Number(match[1]) : 0;
}

export async function assertCouponEligibility(
  db,
  coupon,
  { uid = '', email = '', userDoc = null, productSubtotalYen = 0 } = {},
) {
  const targetType = String(coupon?.targetType || 'all');
  if (!['all', 'specific', 'birthday', 'loyalty'].includes(targetType)) {
    throw new HttpError(403, 'coupon_not_eligible');
  }

  if (targetType === 'specific') {
    const targets = Array.isArray(coupon.targetEmails)
      ? coupon.targetEmails.map((entry) => String(entry).trim().toLowerCase())
      : [];
    if (!email || !targets.includes(email)) throw new HttpError(403, 'coupon_not_eligible');
  }

  if (targetType === 'birthday') {
    const currentMonth = Number(TOKYO_MONTH_FORMAT.format(new Date()));
    if (!userDoc || birthMonth(userDoc.birthdate) !== currentMonth) {
      throw new HttpError(403, 'coupon_not_eligible');
    }
  }

  if (targetType === 'loyalty') {
    const requiredCount = Math.max(1, Math.min(500, Math.floor(Number(coupon.minOrders || 1))));
    if ((await paidOrderCount(db, uid, email, requiredCount)) < requiredCount) {
      throw new HttpError(403, 'coupon_not_eligible');
    }
  }

  const minimum = Math.max(0, Number(coupon?.minOrderValue || 0));
  const subtotal = Math.max(0, Number(productSubtotalYen || 0));
  if (minimum > 0 && subtotal > 0 && subtotal < minimum) {
    throw new HttpError(409, 'coupon_minimum_not_met');
  }
}
