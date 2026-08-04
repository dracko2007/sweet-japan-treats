import { FieldValue } from 'firebase-admin/firestore';
import { purchaseDiscountProfileUpdate } from './cart-recovery-profile.js';
import { adminDb } from './firebase-admin.js';
import { HttpError } from './http.js';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function eventId(provider, reference) {
  return `${provider}:${reference}`.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 300);
}

/**
 * Extrai o percentual de desconto efetivo do pedido.
 *
 * Tenta primeiro calcular a partir de `couponDiscountYen` dividido pelo subtotal
 * de mercadoria (itens que não são brinde ou promoção); se não houver base de
 * cálculo finita/positiva, tenta extrair o número de um código tipo `CARRINHO<n>`
 * (ex: `CARRINHO15` → 15); sem nada disso, retorna 0 (sem desconto).
 */
function extractDiscountPercent(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const regularSubtotal = items
    .filter((item) => !item.homePromo && !item.freeGift)
    .reduce((sum, item) => sum + Number(item.unitYen || 0) * Number(item.quantity || 0), 0);

  if (Number.isFinite(regularSubtotal) && regularSubtotal > 0 && Number.isFinite(order.couponDiscountYen)) {
    const pct = Math.round(Number(order.couponDiscountYen) / regularSubtotal * 100);
    if (Number.isFinite(pct) && pct >= 0) return pct;
  }

  // Fallback: tenta extrair o número do código `CARRINHO<n>`
  if (typeof order.couponCode === 'string') {
    const match = order.couponCode.match(/^CARRINHO(\d{1,2})(?:-[A-Z0-9]+)?$/i);
    if (match) {
      const extracted = Number(match[1]);
      if (Number.isFinite(extracted)) return extracted;
    }
  }

  return 0;
}

export async function fulfillOrder(orderId, { provider, reference, confirmedBy }) {
  const db = adminDb();
  const orderRef = db.collection('orders').doc(orderId);

  const result = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new HttpError(404, 'order_not_found');
    const order = orderSnap.data();
    if (order.fulfillmentState === 'fulfilled') return { replay: true, order };
    if (order.status === 'cancelled') throw new HttpError(409, 'order_cancelled');
    if (provider === 'stripe' && order.stripePaymentIntentId !== reference) throw new HttpError(409, 'payment_reference_mismatch');

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) throw new HttpError(409, 'order_has_no_items');
    const quantities = new Map();
    for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + Number(item.quantity || 0));

    const productRefs = [...quantities.keys()].map((productId) => db.collection('products').doc(productId));
    const eventRef = db.collection('fulfillment_events').doc(eventId(provider, reference));
    const userRef = db.collection('users').doc(order.userId);
    const homePromoRef = db.collection('siteContent').doc('homePromotion');
    const cpfRef = order.cpf ? db.collection('cpf_index').doc(order.cpf) : null;
    const promoUsageRef = order.promoCode && order.cpf ? db.collection('promo_usage').doc(`${order.promoCode}_${order.cpf}`) : null;
    const couponRef = order.couponSource === 'global' && order.couponCode ? db.collection('coupons').doc(order.couponCode) : null;
    const couponUsageRef = order.couponSource === 'global' && order.couponCode ? db.collection('coupon_usage').doc(order.couponCode) : null;
    const affiliateRef = order.affiliateCode ? db.collection('affiliates').doc(order.affiliateCode) : null;
    const pendingCommissionRef = order.affiliateCode ? db.collection('affiliate_pending').doc(`${order.affiliateCode}-${orderId}`) : null;
    const negotiationRef = order.negotiationId ? db.collection('negotiations').doc(order.negotiationId) : null;
    const recoveryProfileRef = order.userId ? db.collection('cart_recovery_profiles').doc(order.userId) : null;

    const refs = [
      ...productRefs,
      eventRef,
      userRef,
      ...(order.homePromoQuantity ? [homePromoRef] : []),
      ...(cpfRef ? [cpfRef] : []),
      ...(promoUsageRef ? [promoUsageRef] : []),
      ...(couponRef ? [couponRef] : []),
      ...(couponUsageRef ? [couponUsageRef] : []),
      ...(affiliateRef ? [affiliateRef] : []),
      ...(pendingCommissionRef ? [pendingCommissionRef] : []),
      ...(negotiationRef ? [negotiationRef] : []),
    ];
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const byPath = new Map(snapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
    const eventSnap = byPath.get(eventRef.path);
    if (eventSnap.exists) {
      if (eventSnap.data()?.orderId === orderId) return { replay: true, order };
      throw new HttpError(409, 'payment_reference_reused');
    }

    for (const ref of productRefs) {
      const productSnap = byPath.get(ref.path);
      if (!productSnap.exists) throw new HttpError(409, 'product_unavailable');
      const product = productSnap.data();
      const quantity = quantities.get(ref.id);
      if (product.stock?.unlimited === false && Number(product.stock.quantity || 0) < quantity) {
        throw new HttpError(409, 'insufficient_stock');
      }
    }

    const cpfSnap = cpfRef ? byPath.get(cpfRef.path) : null;
    const cpfData = cpfSnap?.exists ? cpfSnap.data() : { productIds: [], affiliateCodes: [] };
    const limitedProducts = items.filter((item) => item.homePromo).map((item) => item.productId);
    if (limitedProducts.some((productId) => cpfData.productIds?.includes(productId))) throw new HttpError(409, 'promotion_limit');
    if (order.affiliateCode && !order.affiliateProductId && cpfData.affiliateCodes?.length) throw new HttpError(409, 'affiliate_coupon_already_used');
    if (promoUsageRef && byPath.get(promoUsageRef.path).exists) throw new HttpError(409, 'promotion_already_used');

    let nextHomePromo = null;
    if (order.homePromoQuantity) {
      const homeSnap = byPath.get(homePromoRef.path);
      if (!homeSnap.exists) throw new HttpError(409, 'promotion_unavailable');
      const home = homeSnap.data();
      const homeProduct = items.find((item) => item.homePromo)?.productId;
      if (home.productId !== homeProduct) throw new HttpError(409, 'promotion_changed');
      const soldCount = Number(home.soldCount || 0) + Number(order.homePromoQuantity || 0);
      if (home.maxProducts != null && soldCount > Number(home.maxProducts)) throw new HttpError(409, 'promotion_unavailable');
      if (home.maxProducts != null && soldCount >= Number(home.maxProducts) && home.nextPromo) {
        const scheduled = home.nextPromo;
        nextHomePromo = {
          ...scheduled,
          expiresAt: scheduled.durationDays ? Date.now() + Number(scheduled.durationDays) * 86400000 : null,
          soldCount: 0,
          nextPromo: null,
        };
      } else {
        nextHomePromo = { ...home, soldCount };
      }
    }

    const userSnap = byPath.get(userRef.path);
    const registeredUser = userSnap.exists && order.customerType !== 'guest';
    const userData = userSnap.exists ? userSnap.data() : null;
    const currentPoints = Number(userData?.points || 0);
    if (Number(order.redeemPoints || 0) > currentPoints) throw new HttpError(409, 'insufficient_points');

    const couponSnap = couponRef ? byPath.get(couponRef.path) : null;
    const couponUsageSnap = couponUsageRef ? byPath.get(couponUsageRef.path) : null;
    if (couponSnap) {
      if (!couponSnap.exists) throw new HttpError(409, 'coupon_unavailable');
      const coupon = couponSnap.data();
      if (coupon.isActive === false || (coupon.usageLimit && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit))) throw new HttpError(409, 'coupon_unavailable');
      const usedBy = Array.isArray(couponUsageSnap.data()?.usedBy) ? couponUsageSnap.data().usedBy : [];
      if (usedBy.map((email) => String(email).toLowerCase()).includes(String(order.customerEmail).toLowerCase())) throw new HttpError(409, 'coupon_already_used');
    }

    const affiliateSnap = affiliateRef ? byPath.get(affiliateRef.path) : null;
    if (affiliateRef && (!affiliateSnap.exists || affiliateSnap.data()?.active === false)) throw new HttpError(409, 'affiliate_unavailable');

    for (const ref of productRefs) {
      const product = byPath.get(ref.path).data();
      const quantity = quantities.get(ref.id);
      const update = { salesCount: Number(product.salesCount || 0) + quantity };
      if (product.stock?.unlimited === false) update['stock.quantity'] = Number(product.stock.quantity || 0) - quantity;
      transaction.update(ref, update);
    }
    transaction.create(eventRef, { orderId, provider, reference, createdAt: new Date().toISOString() });

    if (nextHomePromo) transaction.set(homePromoRef, nextHomePromo);
    if (cpfRef) {
      transaction.set(cpfRef, {
        productIds: unique([...(cpfData.productIds || []), ...limitedProducts]),
        affiliateCodes: unique([...(cpfData.affiliateCodes || []), ...(order.affiliateCode && !order.affiliateProductId ? [order.affiliateCode] : [])]),
      }, { merge: true });
    }
    if (promoUsageRef) {
      transaction.create(promoUsageRef, {
        code: order.promoCode,
        cpf: order.cpf,
        email: order.customerEmail,
        orderId,
        usedAt: Date.now(),
      });
    }
    if (couponRef) transaction.update(couponRef, { usedCount: Number(couponSnap.data().usedCount || 0) + 1 });
    if (couponUsageRef) {
      const usedBy = Array.isArray(couponUsageSnap.data()?.usedBy) ? couponUsageSnap.data().usedBy : [];
      transaction.set(couponUsageRef, { usedBy: unique([...usedBy, order.customerEmail]), updatedAt: new Date().toISOString() }, { merge: true });
    }

    if (registeredUser) {
      const coupons = Array.isArray(userData.coupons) ? userData.coupons : [];
      let nextCoupons = coupons;
      if (order.couponSource === 'personal' && order.couponCode) {
        nextCoupons = coupons.map((coupon) => String(coupon.code || '').toUpperCase() === order.couponCode ? { ...coupon, isUsed: true } : coupon);
      }
      if (order.promoCouponCode && !nextCoupons.some((coupon) => String(coupon.code || '').toUpperCase() === String(order.promoCouponCode).toUpperCase())) {
        nextCoupons = [...nextCoupons, {
          id: `promo-${order.promoCode}`,
          code: order.promoCouponCode,
          description: `Cupom promocional ${order.promoCouponCode}`,
          discount: 10,
          discountType: 'percentage',
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          isUsed: false,
        }];
      }
      transaction.update(userRef, {
        points: currentPoints - Number(order.redeemPoints || 0) + Number(order.earnedPoints || 0) + Number(order.promoPoints || 0),
        coupons: nextCoupons,
        updatedAt: new Date().toISOString(),
      });
    }

    if (affiliateRef && pendingCommissionRef) {
      const affiliate = affiliateSnap.data();
      const netYen = Number(order.items.filter((item) => !item.freeGift).reduce((sum, item) => sum + Number(item.unitYen || 0) * Number(item.quantity || 0), 0));
      transaction.set(pendingCommissionRef, {
        id: pendingCommissionRef.id,
        affiliateCode: order.affiliateCode,
        netYen,
        commissionYen: Math.round(netYen * Number(affiliate.commissionPercent || 0) / 100),
        orderId,
        buyerEmail: order.customerEmail,
        ownerEmail: affiliate.ownerEmail || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }
    if (negotiationRef && byPath.get(negotiationRef.path).exists) {
      transaction.update(negotiationRef, { status: 'used', usedAt: new Date().toISOString(), orderId });
    }
    if (recoveryProfileRef) {
      transaction.set(
        recoveryProfileRef,
        purchaseDiscountProfileUpdate(extractDiscountPercent(order)),
        { merge: true },
      );
    }

    const fulfilledAt = new Date().toISOString();
    transaction.update(orderRef, {
      status: 'confirmed',
      fulfillmentState: 'fulfilled',
      fulfilledAt,
      paymentConfirmed: true,
      paymentConfirmedAt: fulfilledAt,
      paymentConfirmedBy: confirmedBy,
      paymentProvider: provider,
      paymentReference: reference,
      updatedAt: fulfilledAt,
    });
    return { replay: false, order: { ...order, status: 'confirmed', fulfillmentState: 'fulfilled', fulfilledAt } };
  });


  return result;
}

export async function markFulfillmentReview(orderId, reason) {
  const db = adminDb();
  await db.collection('orders').doc(orderId).set({
    status: 'payment_review',
    fulfillmentState: 'review',
    fulfillmentError: String(reason || 'fulfillment_failed').slice(0, 120),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
