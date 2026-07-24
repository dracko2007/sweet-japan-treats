import { randomInt } from 'node:crypto';
import Stripe from 'stripe';
import { requireUser } from './_lib/auth.js';
import { buildQuote } from './_lib/commerce.js';
import { adminDb } from './_lib/firebase-admin.js';
import { getFxRates } from './_lib/fx.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  normalizeEmail,
  optionalText,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

const PAYMENT_METHODS = new Set(['card', 'pix', 'bank', 'paypay', 'yucho', 'wise']);
const ORDER_PATTERN = /^(?:SC-JP|SE-[A-Z]{2})-\d{6}$/;

function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100) throw new HttpError(400, 'invalid_items');
  return raw.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'invalid_items');
    assertExactKeys(item, ['productId', 'variantId', 'quantity']);
    return {
      productId: requiredText(item.productId, { max: 120, pattern: /^[A-Za-z0-9_.-]+$/ }),
      variantId: requiredText(item.variantId, { max: 120, pattern: /^[A-Za-z0-9_.-]+$/ }),
      quantity: Number(item.quantity),
    };
  });
}

function parseCustomer(raw, user) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'invalid_customer');
  assertExactKeys(raw, ['name', 'email', 'phone', 'cpf', 'postalCode', 'city', 'address', 'building']);
  const tokenEmail = user.email ? normalizeEmail(user.email) : '';
  const submittedEmail = normalizeEmail(raw.email);
  if (tokenEmail && tokenEmail !== submittedEmail) throw new HttpError(403, 'email_mismatch');
  const cpf = String(raw.cpf || '').replace(/\D/g, '');
  if (cpf && cpf.length !== 11) throw new HttpError(400, 'invalid_cpf');
  return {
    name: requiredText(raw.name, { max: 120 }),
    email: tokenEmail || submittedEmail,
    phone: optionalText(raw.phone, { max: 40 }),
    cpf,
    postalCode: requiredText(raw.postalCode, { max: 24 }),
    city: requiredText(raw.city, { max: 120 }),
    address: requiredText(raw.address, { max: 240 }),
    building: optionalText(raw.building, { max: 160 }),
  };
}

function carrierId(value) {
  const text = String(value || '').toLowerCase();
  if (['yuubin', 'yamato', 'sagawa', 'eraito', 'kozutsumi-air', 'ems'].includes(text)) return text;
  if (text.includes('yamato')) return 'yamato';
  if (text.includes('sagawa')) return 'sagawa';
  if (text.includes('local') || text.includes('ゆうパック')) return 'yuubin';
  if (text.includes('e-light') || text.includes('パケットライト')) return 'eraito';
  if (text.includes('kozutsumi') || text.includes('小包')) return 'kozutsumi-air';
  if (text.includes('ems')) return 'ems';
  throw new HttpError(400, 'invalid_shipping');
}

function activeByDate(value) {
  if (!value) return true;
  const timestamp = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

async function resolveCoupon(db, code, userDoc, customer, productSubtotalHint = 0) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  const personal = Array.isArray(userDoc?.coupons)
    ? userDoc.coupons.find((coupon) => String(coupon.code || '').toUpperCase() === normalized)
    : null;
  if (personal) {
    if (personal.isUsed || !activeByDate(personal.expiresAt)) throw new HttpError(409, 'coupon_unavailable');
    return { ...personal, code: normalized, source: 'personal' };
  }

  const [globalSnap, usageSnap, affiliateSnap] = await Promise.all([
    db.collection('coupons').doc(normalized).get(),
    db.collection('coupon_usage').doc(normalized).get(),
    db.collection('affiliates').doc(normalized).get(),
  ]);
  if (globalSnap.exists) {
    const coupon = globalSnap.data();
    if (coupon.isActive === false || !activeByDate(coupon.expiryDate) || (coupon.usageLimit && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit))) {
      throw new HttpError(409, 'coupon_unavailable');
    }
    if (Array.isArray(usageSnap.data()?.usedBy) && usageSnap.data().usedBy.map((email) => String(email).toLowerCase()).includes(customer.email)) {
      throw new HttpError(409, 'coupon_already_used');
    }
    if (coupon.targetType === 'specific' && !coupon.targetEmails?.map((email) => String(email).toLowerCase()).includes(customer.email)) {
      throw new HttpError(403, 'coupon_not_eligible');
    }
    if (coupon.targetType === 'birthday') {
      const birthdate = String(userDoc?.birthdate || '');
      if (!birthdate || new Date(birthdate).getMonth() !== new Date().getMonth()) throw new HttpError(403, 'coupon_not_eligible');
    }
    if (coupon.minOrderValue && productSubtotalHint && productSubtotalHint < Number(coupon.minOrderValue)) throw new HttpError(409, 'coupon_minimum_not_met');
    return { ...coupon, code: normalized, discountType: coupon.type === 'fixed' ? 'fixed' : 'percentage', source: 'global' };
  }
  if (affiliateSnap.exists) {
    const affiliate = affiliateSnap.data();
    if (affiliate.active === false || !activeByDate(affiliate.expiresAt)) throw new HttpError(409, 'coupon_unavailable');
    return {
      code: normalized,
      discount: Number(affiliate.discountPercent || 0),
      discountType: 'percentage',
      affiliateCode: normalized,
      affiliateProductId: affiliate.productId || '',
      commissionPercent: Number(affiliate.commissionPercent || 0),
      ownerEmail: affiliate.ownerEmail || '',
      source: 'affiliate',
    };
  }
  throw new HttpError(404, 'coupon_not_found');
}

function publicOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    orderDate: order.orderDate,
    totalPrice: order.totalPrice,
    total: order.total,
    totalAmount: order.totalAmount,
    totalYen: order.totalYen,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    trackingCode: order.trackingCode,
    couponCode: order.couponCode,
    couponDiscountYen: order.couponDiscountYen,
    taxAmount: order.taxAmount,
    shippingCarrier: order.shippingCarrier,
    shippingCostYen: order.shippingCostYen,
    shipping: order.shipping,
    psFeeYen: order.psFeeYen,
    shippingAddress: order.shippingAddress,
    items: order.items.map(({ cost, ...item }) => item),
  };
}

async function stripeIntent(order) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new HttpError(503, 'stripe_not_configured');
  const stripe = new Stripe(secret);
  if (order.stripePaymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    return existing;
  }
  const zeroDecimal = order.currency === 'JPY';
  const amount = zeroDecimal ? Math.round(order.totalPrice) : Math.round(order.totalPrice * 100);
  if (amount < (zeroDecimal ? 50 : 50)) throw new HttpError(400, 'amount_below_minimum');
  return stripe.paymentIntents.create({
    amount,
    currency: order.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    description: `Japan Express - Order ${order.orderNumber}`,
    receipt_email: order.customerEmail,
    metadata: { orderId: order.orderNumber, userId: order.userId },
  }, { idempotencyKey: `payment-intent:${order.orderNumber}` });
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const user = await requireUser(req);
    await enforceRateLimit(req, { scope: 'create-order', limit: 12, windowMs: 30 * 60 * 1000, identity: user.uid });
    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['orderId', 'items', 'country', 'prefecture', 'state', 'shippingCarrier', 'paymentMethod', 'couponCode', 'redeemPoints', 'negotiationId', 'promoCode', 'customer']);
    const orderId = requiredText(body.orderId, { max: 40, pattern: ORDER_PATTERN });
    const requestedItems = parseItems(body.items);
    const country = requiredText(body.country, { max: 100 });
    const prefecture = requiredText(body.prefecture, { max: 100 });
    const state = optionalText(body.state, { max: 100 });
    const carrier = carrierId(body.shippingCarrier);
    const paymentMethod = requiredText(body.paymentMethod, { max: 20 });
    if (!PAYMENT_METHODS.has(paymentMethod)) throw new HttpError(400, 'invalid_payment_method');
    const customer = parseCustomer(body.customer, user);
    const couponCode = optionalText(body.couponCode, { max: 60 }).toUpperCase();
    const promoCode = optionalText(body.promoCode, { max: 60 }).toUpperCase();
    const negotiationId = optionalText(body.negotiationId, { max: 120 });

    const db = adminDb();
    const orderRef = db.collection('orders').doc(orderId);
    const existing = await orderRef.get();
    if (existing.exists) {
      const order = { id: existing.id, ...existing.data() };
      if (order.userId !== user.uid) throw new HttpError(409, 'order_id_conflict');
      const intent = order.paymentMethod === 'card' ? await stripeIntent(order) : null;
      res.status(200).json({ ok: true, order: publicOrder(order), clientSecret: intent?.client_secret || null });
      return;
    }

    const campaignSnap = promoCode ? await db.collection('promo_campaigns').doc(promoCode.toLowerCase()).get() : null;
    const campaign = campaignSnap?.exists ? campaignSnap.data() : null;
    if (promoCode && (!campaign || campaign.active === false || !activeByDate(campaign.expiresAt))) throw new HttpError(409, 'promotion_unavailable');

    const baseProductIds = requestedItems.map((item) => item.productId.replace(/_promo$/, ''));
    if (campaign?.giftProductId) baseProductIds.push(String(campaign.giftProductId));
    const uniqueProductIds = [...new Set(baseProductIds)];
    const productSnaps = await db.getAll(...uniqueProductIds.map((id) => db.collection('products').doc(id)));
    const products = new Map(productSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, { id: snap.id, ...snap.data() }]));

    const [userSnap, homePromoSnap, negotiationSnap, cpfSnap, promoUsageSnap] = await Promise.all([
      db.collection('users').doc(user.uid).get(),
      db.collection('siteContent').doc('homePromotion').get(),
      negotiationId ? db.collection('negotiations').doc(negotiationId).get() : Promise.resolve(null),
      customer.cpf ? db.collection('cpf_index').doc(customer.cpf).get() : Promise.resolve(null),
      promoCode && customer.cpf ? db.collection('promo_usage').doc(`${promoCode}_${customer.cpf}`).get() : Promise.resolve(null),
    ]);
    if (promoUsageSnap?.exists) throw new HttpError(409, 'promotion_already_used');
    const userData = userSnap.exists ? userSnap.data() : null;
    const coupon = await resolveCoupon(db, couponCode, userData, customer);
    const negotiation = negotiationSnap?.exists ? negotiationSnap.data() : null;
    if (negotiation && negotiation.userId && negotiation.userId !== user.uid) throw new HttpError(403, 'invalid_negotiation');
    if (negotiation && negotiation.customerEmail && String(negotiation.customerEmail).toLowerCase() !== customer.email) throw new HttpError(403, 'invalid_negotiation');
    const requestedPoints = Math.max(0, Math.floor(Number(body.redeemPoints || 0)));
    if (requestedPoints > Number(userData?.points || 0)) throw new HttpError(409, 'insufficient_points');
    const rates = await getFxRates();
    const quote = buildQuote({
      requestedItems,
      products,
      country,
      prefecture,
      state,
      carrier,
      paymentMethod,
      coupon,
      redeemPoints: requestedPoints,
      negotiation,
      campaign,
      homePromotion: homePromoSnap.exists ? homePromoSnap.data() : null,
      rates,
    });

    const stockByProduct = new Map();
    for (const item of quote.items) stockByProduct.set(item.productId, (stockByProduct.get(item.productId) || 0) + item.quantity);
    for (const [productId, quantity] of stockByProduct) {
      const product = products.get(productId);
      if (product?.stock?.unlimited === false && Number(product.stock.quantity || 0) < quantity) throw new HttpError(409, 'insufficient_stock');
    }
    const cpfData = cpfSnap?.exists ? cpfSnap.data() : null;
    const promoProducts = quote.items.filter((item) => item.homePromo).map((item) => item.productId);
    if (promoProducts.some((productId) => cpfData?.productIds?.includes(productId))) throw new HttpError(409, 'promotion_limit');
    if (coupon?.affiliateCode && !coupon.affiliateProductId && cpfData?.affiliateCodes?.length) throw new HttpError(409, 'affiliate_coupon_already_used');

    const now = new Date().toISOString();
    const trackingPrefix = country === 'Japão' ? 'JP' : country === 'Brasil' ? 'NX' : 'EX';
    const order = {
      id: orderId,
      orderNumber: orderId,
      userId: user.uid,
      customerName: customer.name,
      customerEmail: customer.email,
      cpf: customer.cpf,
      status: 'pending_payment',
      fulfillmentState: 'pending',
      paymentConfirmed: false,
      orderDate: now,
      date: new Date().toLocaleDateString('pt-BR'),
      totalPrice: quote.total,
      total: quote.total,
      totalAmount: quote.total,
      totalYen: quote.totalYen,
      currency: quote.currency,
      fxSource: rates.source,
      paymentMethod,
      trackingCode: `${trackingPrefix}${randomInt(100000000, 1000000000)}JP`,
      couponCode: couponCode || '',
      couponSource: coupon?.source || '',
      couponDiscountYen: quote.couponDiscountYen,
      affiliateCode: coupon?.affiliateCode || '',
      affiliateProductId: coupon?.affiliateProductId || '',
      affiliateCommissionPercent: coupon?.commissionPercent || 0,
      affiliateOwnerEmail: coupon?.ownerEmail || '',
      promoCode: promoCode || '',
      promoMechanic: campaign?.mechanic || '',
      promoPoints: Number(campaign?.points || 0),
      promoCouponCode: campaign?.couponCode || '',
      redeemPoints: quote.redeemPoints,
      earnedPoints: quote.earnedPoints,
      taxAmount: quote.tax,
      shippingCarrier: carrier,
      shippingCostYen: quote.shippingYen,
      shipping: { carrier, cost: quote.shippingYen, weightG: quote.shippingWeightG },
      psFeeYen: quote.psFeeYen,
      homePromoQuantity: quote.homePromoQuantity,
      negotiationId: negotiationId || '',
      shippingAddress: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        postalCode: customer.postalCode,
        prefecture,
        city: customer.city,
        address: customer.address,
        building: customer.building,
        country,
      },
      items: quote.items.map(({ cost: _cost, ...item }) => item),
      createdAt: now,
      updatedAt: now,
      customerType: user.firebase?.sign_in_provider === 'anonymous' ? 'guest' : 'registered',
    };

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(orderRef);
      if (current.exists) throw new HttpError(409, 'order_id_conflict');
      transaction.create(orderRef, order);
    });

    let intent = null;
    if (paymentMethod === 'card') {
      intent = await stripeIntent(order);
      await orderRef.update({ stripePaymentIntentId: intent.id, updatedAt: new Date().toISOString() });
      order.stripePaymentIntentId = intent.id;
    }

    res.status(201).json({ ok: true, order: publicOrder(order), clientSecret: intent?.client_secret || null });
  } catch (error) {
    console.error('[create-order]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
