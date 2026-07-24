import { beforeEach, describe, expect, it, vi } from 'vitest';

const injected = vi.hoisted(() => ({ db: null }));
vi.mock('./firebase-admin.js', () => ({ adminDb: () => injected.db }));

const { fulfillOrder } = await import('./fulfillment.js');

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function setDotted(target, key, value) {
  const parts = key.split('.');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor[parts[index]] ||= {};
    cursor = cursor[parts[index]];
  }
  cursor[parts.at(-1)] = value;
}

class FakeDb {
  constructor(initial) {
    this.docs = new Map(Object.entries(initial).map(([path, value]) => [path, clone(value)]));
  }

  collection(name) {
    return { doc: (id) => ({ path: `${name}/${id}`, id: String(id) }) };
  }

  snapshot(ref, docs = this.docs) {
    const value = docs.get(ref.path);
    return { ref, id: ref.id, exists: value !== undefined, data: () => clone(value) };
  }

  async runTransaction(callback) {
    const working = new Map([...this.docs].map(([path, value]) => [path, clone(value)]));
    const transaction = {
      get: async (ref) => this.snapshot(ref, working),
      create: (ref, value) => {
        if (working.has(ref.path)) throw new Error('already_exists');
        working.set(ref.path, clone(value));
      },
      set: (ref, value, options) => {
        const next = options?.merge ? { ...(working.get(ref.path) || {}), ...clone(value) } : clone(value);
        working.set(ref.path, next);
      },
      update: (ref, value) => {
        if (!working.has(ref.path)) throw new Error('not_found');
        const next = clone(working.get(ref.path));
        for (const [key, fieldValue] of Object.entries(value)) setDotted(next, key, clone(fieldValue));
        working.set(ref.path, next);
      },
      delete: (ref) => working.delete(ref.path),
    };
    const result = await callback(transaction);
    this.docs = working;
    return result;
  }

  get(path) {
    return clone(this.docs.get(path));
  }
}

function order(id = 'O1', overrides = {}) {
  return {
    id,
    orderNumber: id,
    userId: `user-${id}`,
    customerEmail: `${id.toLowerCase()}@example.com`,
    customerType: 'registered',
    status: 'pending_payment',
    fulfillmentState: 'pending',
    paymentMethod: 'pix',
    items: [{ productId: 'p1', quantity: 1, unitYen: 1000, freeGift: false, homePromo: false }],
    redeemPoints: 0,
    earnedPoints: 10,
    promoPoints: 0,
    homePromoQuantity: 0,
    ...overrides,
  };
}

function database(orderValue = order(), productQuantity = 2, extras = {}) {
  return new FakeDb({
    [`orders/${orderValue.orderNumber}`]: orderValue,
    'products/p1': { name: 'Produto', stock: { unlimited: false, quantity: productQuantity }, salesCount: 0 },
    [`users/${orderValue.userId}`]: { points: 100, coupons: [] },
    ...extras,
  });
}

beforeEach(() => {
  injected.db = null;
});

describe('payment fulfillment transaction', () => {
  it('leaves a manual order and stock untouched until payment confirmation', () => {
    const db = database();
    expect(db.get('orders/O1').status).toBe('pending_payment');
    expect(db.get('products/p1').stock.quantity).toBe(2);
  });

  it('applies stock and rewards once and treats replay as a no-op', async () => {
    const db = database();
    injected.db = db;
    const first = await fulfillOrder('O1', { provider: 'manual', reference: 'pix:O1', confirmedBy: 'admin' });
    expect(first.replay).toBe(false);
    expect(db.get('products/p1').stock.quantity).toBe(1);
    expect(db.get('products/p1').salesCount).toBe(1);
    expect(db.get('users/user-O1').points).toBe(110);
    expect(db.get('orders/O1')).toMatchObject({ status: 'confirmed', fulfillmentState: 'fulfilled' });

    const second = await fulfillOrder('O1', { provider: 'manual', reference: 'pix:O1', confirmedBy: 'admin' });
    expect(second.replay).toBe(true);
    expect(db.get('products/p1').stock.quantity).toBe(1);
    expect(db.get('users/user-O1').points).toBe(110);
  });

  it('rolls back every write when stock is insufficient', async () => {
    const insufficient = order('O1', { items: [{ productId: 'p1', quantity: 3, unitYen: 1000, freeGift: false, homePromo: false }] });
    const db = database(insufficient, 2);
    injected.db = db;
    await expect(fulfillOrder('O1', { provider: 'manual', reference: 'pix:O1', confirmedBy: 'admin' })).rejects.toMatchObject({ code: 'insufficient_stock' });
    expect(db.get('products/p1').stock.quantity).toBe(2);
    expect(db.get('orders/O1').fulfillmentState).toBe('pending');
    expect(db.get('fulfillment_events/manual:pix:O1')).toBeUndefined();
  });

  it('prevents two paid orders from exceeding a promotion cap', async () => {
    const first = order('O1', {
      cpf: '11111111111',
      homePromoQuantity: 1,
      items: [{ productId: 'p1', quantity: 1, unitYen: 500, freeGift: false, homePromo: true }],
    });
    const second = order('O2', {
      cpf: '22222222222',
      homePromoQuantity: 1,
      items: [{ productId: 'p1', quantity: 1, unitYen: 500, freeGift: false, homePromo: true }],
    });
    const db = database(first, 5, {
      'orders/O2': second,
      'users/user-O2': { points: 100, coupons: [] },
      'siteContent/homePromotion': { productId: 'p1', soldCount: 0, maxProducts: 1, nextPromo: null },
    });
    injected.db = db;
    await fulfillOrder('O1', { provider: 'manual', reference: 'first', confirmedBy: 'admin' });
    await expect(fulfillOrder('O2', { provider: 'manual', reference: 'second', confirmedBy: 'admin' })).rejects.toMatchObject({ code: 'promotion_unavailable' });
    expect(db.get('siteContent/homePromotion').soldCount).toBe(1);
    expect(db.get('products/p1').stock.quantity).toBe(4);
  });
});
