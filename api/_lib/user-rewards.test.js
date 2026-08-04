import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimBirthday,
  claimProductReview,
  claimSocialFollow,
} from '../user-rewards.js';

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

class FakeQuery {
  constructor(db, collectionName, filters = [], max = Infinity) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = filters;
    this.max = max;
  }

  where(field, operator, value) {
    if (operator !== '==') throw new Error('unsupported_operator');
    return new FakeQuery(this.db, this.collectionName, [...this.filters, { field, value }], this.max);
  }

  limit(max) {
    return new FakeQuery(this.db, this.collectionName, this.filters, max);
  }

  async get() {
    const prefix = `${this.collectionName}/`;
    const docs = [];
    for (const [path, value] of this.db.docs) {
      if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
      if (!this.filters.every((filter) => value?.[filter.field] === filter.value)) continue;
      const id = path.slice(prefix.length);
      docs.push({ id, exists: true, data: () => clone(value) });
      if (docs.length >= this.max) break;
    }
    return { docs, empty: docs.length === 0 };
  }
}

class FakeDb {
  constructor(initial) {
    this.docs = new Map(Object.entries(initial).map(([path, value]) => [path, clone(value)]));
  }

  collection(name) {
    const query = new FakeQuery(this, name);
    query.doc = (id) => ({ path: `${name}/${id}`, id: String(id) });
    return query;
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
      update: (ref, value) => {
        if (!working.has(ref.path)) throw new Error('not_found');
        working.set(ref.path, { ...working.get(ref.path), ...clone(value) });
      },
    };
    const result = await callback(transaction);
    this.docs = working;
    return result;
  }

  get(path) {
    return clone(this.docs.get(path));
  }
}

const user = { uid: 'u1', email: 'buyer@example.com' };

afterEach(() => {
  vi.useRealTimers();
});

describe('server-defined user rewards', () => {
  it('awards each social network once and ignores replay', async () => {
    const db = new FakeDb({ 'users/u1': { points: 100, socialFollows: {} } });

    await expect(claimSocialFollow(db, user, { action: 'social-follow', network: 'instagram', points: 999999 }))
      .rejects.toMatchObject({ statusCode: 400 });

    const first = await claimSocialFollow(db, user, { action: 'social-follow', network: 'instagram' });
    const replay = await claimSocialFollow(db, user, { action: 'social-follow', network: 'instagram' });

    expect(first).toEqual({ ok: true, awarded: 500, total: 600, alreadyClaimed: false });
    expect(replay).toEqual({ ok: true, awarded: 0, total: 600, alreadyClaimed: true });
    expect(db.get('users/u1')).toMatchObject({ points: 600, socialFollows: { instagram: true } });
  });

  it('derives birthday eligibility in Tokyo and awards once per year', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-14T15:30:00.000Z'));
    const db = new FakeDb({ 'users/u1': { points: 10, birthdate: '1990-01-15' } });

    const first = await claimBirthday(db, user, { action: 'birthday' });
    const replay = await claimBirthday(db, user, { action: 'birthday' });

    expect(first).toEqual({ ok: true, awarded: 1000, total: 1010, alreadyClaimed: false });
    expect(replay).toEqual({ ok: true, awarded: 0, total: 1010, alreadyClaimed: true });
    expect(db.get('users/u1')).toMatchObject({ points: 1010, birthdayBonusYear: 2026 });
  });

  it('rejects a birthday reward on any other Tokyo date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-13T15:30:00.000Z'));
    const db = new FakeDb({ 'users/u1': { points: 10, birthdate: '1990-01-15' } });

    await expect(claimBirthday(db, user, { action: 'birthday' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'birthday_unavailable' });
    expect(db.get('users/u1').points).toBe(10);
  });

  it('requires a paid product order and credits one review point once', async () => {
    const db = new FakeDb({
      'users/u1': { points: 50 },
      'orders/O1': {
        userId: 'u1',
        customerEmail: 'buyer@example.com',
        paymentConfirmed: true,
        items: [{ productId: 'p1' }],
      },
    });

    const first = await claimProductReview(db, user, { action: 'product-review', productId: 'p1' });
    const replay = await claimProductReview(db, user, { action: 'product-review', productId: 'p1' });

    expect(first).toEqual({ ok: true, awarded: 1, total: 51, alreadyClaimed: false });
    expect(replay).toEqual({ ok: true, awarded: 0, total: 51, alreadyClaimed: true });
    expect(db.get('users/u1').points).toBe(51);
  });

  it('does not reward a review for an unpaid order', async () => {
    const db = new FakeDb({
      'users/u1': { points: 50 },
      'orders/O1': {
        userId: 'u1',
        status: 'pending_payment',
        paymentConfirmed: false,
        items: [{ productId: 'p1' }],
      },
    });

    await expect(claimProductReview(db, user, { action: 'product-review', productId: 'p1' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'verified_purchase_required' });
    expect(db.get('users/u1').points).toBe(50);
  });
});
