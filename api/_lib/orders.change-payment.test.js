import { beforeEach, describe, expect, it, vi } from 'vitest';

const injected = vi.hoisted(() => ({ user: null, db: null, intents: [] }));
vi.mock('./auth.js', () => ({ requireUser: async () => injected.user, requireAdmin: async () => injected.user }));
vi.mock('./firebase-admin.js', () => ({ adminDb: () => injected.db }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: async () => {} }));
vi.mock('stripe', () => ({
  default: class Stripe {
    constructor() {
      this.paymentIntents = {
        retrieve: async (id) => ({ id, client_secret: `${id}_secret_x` }),
        create: async (params) => {
          injected.intents.push(params);
          return { id: 'pi_new', client_secret: 'pi_new_secret_x' };
        },
      };
    }
  },
}));

const { handleChangePaymentMethod } = await import('../orders.js');

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

function database(order, settings = { cardEnabled: true }) {
  const state = { order: structuredClone(order) };
  return {
    state,
    collection(name) {
      return {
        doc() {
          return {
            async get() {
              if (name === 'settings') return { exists: Boolean(settings), data: () => settings };
              return { id: 'SE-BR-1', exists: Boolean(state.order), data: () => structuredClone(state.order) };
            },
            async update(value) { state.order = { ...state.order, ...structuredClone(value) }; },
          };
        },
      };
    },
  };
}

const wiseOrder = {
  orderNumber: 'SE-BR-1', userId: 'u1', customerEmail: 'u1@example.com', status: 'pending_payment',
  paymentMethod: 'wise', totalPrice: 450, total: 450, currency: 'BRL',
  items: [{ productId: 'p1', productName: 'Sabonete Corporal', size: 'small', quantity: 2 }, { productId: 'p2', productName: 'Mascara', size: 'large', quantity: 1 }],
  shippingAddress: { country: 'Brasil' },
};

async function call(body = { orderId: 'SE-BR-1', paymentMethod: 'card' }) {
  const res = response();
  await handleChangePaymentMethod({ method: 'POST', headers: {}, body }, res);
  return res;
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
  injected.user = { uid: 'u1', email: 'u1@example.com' };
  injected.intents = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('troca de pagamento do pedido (Wise -> cartão)', () => {
  it('troca para cartão, mantém o total e devolve o clientSecret', async () => {
    injected.db = database(wiseOrder);
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body.clientSecret).toBe('pi_new_secret_x');
    expect(injected.intents[0]).toMatchObject({ amount: 45000, currency: 'brl' });
    // O painel do Stripe mostra o que foi comprado.
    expect(injected.intents[0].description).toBe('Japan Express - Order SE-BR-1: 2x Sabonete Corporal, 1x Mascara (large)');
    expect(injected.intents[0].metadata).toMatchObject({ orderId: 'SE-BR-1', items: '2x Sabonete Corporal, 1x Mascara (large)' });
    expect(injected.db.state.order).toMatchObject({ paymentMethod: 'card', previousPaymentMethod: 'wise', stripePaymentIntentId: 'pi_new', totalPrice: 450 });
  });

  it('recusa pedido de outra pessoa', async () => {
    injected.db = database({ ...wiseOrder, userId: 'outro', customerEmail: 'outro@example.com' });
    expect((await call()).statusCode).toBe(403);
    expect(injected.db.state.order.paymentMethod).toBe('wise');
  });

  it('recusa pedido já pago e pedido cancelado', async () => {
    injected.db = database({ ...wiseOrder, status: 'confirmed', paymentConfirmed: true });
    expect((await call()).body.error).toBe('order_not_payable');
    injected.db = database({ ...wiseOrder, status: 'cancelled' });
    expect((await call()).body.error).toBe('order_not_payable');
  });

  it('recusa trocar PIX (o total mudaria) e cartão desligado', async () => {
    injected.db = database({ ...wiseOrder, paymentMethod: 'pix' });
    expect((await call()).body.error).toBe('payment_change_unavailable');
    injected.db = database(wiseOrder, { cardEnabled: false });
    expect((await call()).body.error).toBe('payment_method_disabled');
    expect(injected.db.state.order.paymentMethod).toBe('wise');
  });

  it('só aceita "card" como destino', async () => {
    injected.db = database(wiseOrder);
    expect((await call({ orderId: 'SE-BR-1', paymentMethod: 'pix' })).statusCode).toBe(400);
  });
});
