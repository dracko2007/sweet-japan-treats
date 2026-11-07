import { beforeEach, describe, expect, it, vi } from 'vitest';

// Aprovação automática do desconto na taxa PS: até ¥300 por item, decidida
// pelo servidor a partir do catálogo. A tela prometia "sai aprovado na hora"
// e ninguém aprovava; o navegador também não pode aprovar sozinho.
const injected = vi.hoisted(() => ({ user: null, db: null }));
vi.mock('./auth.js', () => ({
  requireUser: async () => injected.user,
  requireAdmin: async () => injected.user,
}));
vi.mock('./firebase-admin.js', () => ({ adminDb: () => injected.db }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: async () => {} }));

const { handleNegotiationAutoApprove } = await import('../orders.js');

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

function snap(id, data) {
  return { id, exists: Boolean(data), data: () => (data ? structuredClone(data) : undefined) };
}

function database({ negotiation, products }) {
  const state = { negotiation: structuredClone(negotiation), updates: 0 };
  const ref = (collection, id) => ({ collection, id });
  const db = {
    state,
    collection(name) {
      return {
        doc(id) {
          const docRef = ref(name, id);
          if (name === 'negotiations') {
            docRef.get = async () => snap(id, state.negotiation);
          }
          return docRef;
        },
      };
    },
    async getAll(...refs) {
      return refs.map((entry) => snap(entry.id, products[entry.id] || null));
    },
    async runTransaction(work) {
      return work({
        get: async () => snap('n1', state.negotiation),
        update: (_ref, value) => {
          state.negotiation = { ...state.negotiation, ...structuredClone(value) };
          state.updates += 1;
        },
      });
    },
  };
  return db;
}

function negotiation(overrides = {}) {
  return {
    id: 'n1',
    userId: 'u1',
    status: 'pending',
    type: 'ps_fee',
    requestedDiscountYen: 300,
    originalAmountYen: 1000,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    cartItems: [{ productId: 'mask', size: 'small', quantity: 1 }],
    ...overrides,
  };
}

async function call(body) {
  const res = response();
  await handleNegotiationAutoApprove({ method: 'POST', headers: {}, body }, res);
  return res;
}

beforeEach(() => {
  injected.user = { uid: 'u1', email: 'u1@example.com', email_verified: true };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PS fee negotiation auto-approval', () => {
  it('approves ¥300 on one item, marked as system approval', async () => {
    injected.db = database({ negotiation: negotiation(), products: { mask: { name: 'Mask' } } });

    const res = await call({ negotiationId: 'n1' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: 'auto_approved', approvedDiscountYen: 300, maxAutoYen: 300 });
    expect(injected.db.state.negotiation).toMatchObject({
      status: 'auto_approved',
      autoApproved: true,
      approvedDiscountYen: 300,
      approvedBy: 'system',
    });
  });

  it('keeps it pending for the seller above ¥300 per item', async () => {
    injected.db = database({
      negotiation: negotiation({ requestedDiscountYen: 301 }),
      products: { mask: { name: 'Mask' } },
    });

    const res = await call({ negotiationId: 'n1' });

    expect(res.body).toMatchObject({ status: 'pending', approvedDiscountYen: null });
    expect(injected.db.state.updates).toBe(0);
    expect(injected.db.state.negotiation.status).toBe('pending');
  });

  it('counts units from the catalog: PS-exempt products do not raise the cap', async () => {
    injected.db = database({
      negotiation: negotiation({
        requestedDiscountYen: 600,
        originalAmountYen: 2000,
        cartItems: [
          { productId: 'mask', size: 'small', quantity: 1 },
          { productId: 'gift-box', size: 'small', quantity: 1 },
        ],
      }),
      products: { mask: { name: 'Mask' }, 'gift-box': { name: 'Box', noPsFee: true } },
    });

    const res = await call({ negotiationId: 'n1' });

    expect(res.body).toMatchObject({ status: 'pending', maxAutoYen: 300 });
    expect(injected.db.state.updates).toBe(0);
  });

  it('scales with quantity: ¥600 on two units is approved', async () => {
    injected.db = database({
      negotiation: negotiation({
        requestedDiscountYen: 600,
        originalAmountYen: 2000,
        cartItems: [{ productId: 'mask', size: 'small', quantity: 2 }],
      }),
      products: { mask: { name: 'Mask' } },
    });

    const res = await call({ negotiationId: 'n1' });

    expect(res.body).toMatchObject({ status: 'auto_approved', approvedDiscountYen: 600, maxAutoYen: 600 });
  });

  it('never auto-approves a shipping negotiation', async () => {
    injected.db = database({
      negotiation: negotiation({ type: 'shipping', requestedDiscountYen: 100, originalAmountYen: 3000 }),
      products: { mask: { name: 'Mask' } },
    });

    const res = await call({ negotiationId: 'n1' });

    expect(res.body).toMatchObject({ status: 'pending' });
    expect(injected.db.state.updates).toBe(0);
  });

  it("refuses someone else's negotiation", async () => {
    injected.db = database({ negotiation: negotiation({ userId: 'other' }), products: { mask: {} } });

    const res = await call({ negotiationId: 'n1' });

    expect(res.statusCode).toBe(403);
    expect(injected.db.state.updates).toBe(0);
  });

  it('refuses an expired negotiation', async () => {
    injected.db = database({
      negotiation: negotiation({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
      products: { mask: {} },
    });

    const res = await call({ negotiationId: 'n1' });

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'negotiation_expired' });
  });

  it('does not touch a negotiation the seller already decided', async () => {
    injected.db = database({
      negotiation: negotiation({ status: 'approved', approvedDiscountYen: 700, approvedBy: 'owner@example.com' }),
      products: { mask: {} },
    });

    const res = await call({ negotiationId: 'n1' });

    expect(res.body).toMatchObject({ status: 'approved', approvedDiscountYen: 700 });
    expect(injected.db.state.updates).toBe(0);
  });

  it('rejects extra fields in the body', async () => {
    injected.db = database({ negotiation: negotiation(), products: { mask: {} } });

    const res = await call({ negotiationId: 'n1', approvedDiscountYen: 1000 });

    expect(res.statusCode).toBe(400);
    expect(injected.db.state.updates).toBe(0);
  });
});
