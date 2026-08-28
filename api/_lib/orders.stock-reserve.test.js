// Integração da reserva de estoque comum: dois checkouts simultâneos na
// última unidade de um produto normal (sem ser a promoção da home) devem
// resultar em um 409 `insufficient_stock` ao criar o segundo pedido, não em
// dois pedidos criados e o segundo só descobrindo o problema depois — em
// `fulfillment.js`, na hora de confirmar um PIX/Wise que o cliente já pagou.
//
// Harness idêntico ao de `orders.promo-reserve.test.js` (mesma FakeDb),
// trocando a disputa de `promo_state/homePromotion` por
// `stock_reserve/{productId}`.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const injected = vi.hoisted(() => ({ db: null }));
const mocks = vi.hoisted(() => ({ verify: vi.fn(), limitar: vi.fn() }));

vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limitar }));

vi.mock('./fx.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getFxRates: async () => ({ BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150, source: 'fallback' }),
}));

vi.mock('./mailer.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendMail: vi.fn(),
}));

vi.mock('./firebase-admin.js', () => ({
  adminAuth: () => ({ verifyIdToken: mocks.verify }),
  adminDb: () => injected.db,
}));

const { handleCreate } = await import('../orders.js');

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
    const banco = this;
    return {
      doc: (id) => {
        const ref = { path: `${name}/${id}`, id: String(id) };
        ref.get = async () => banco.snapshot(ref);
        ref.set = async (value, options) => {
          const anterior = options?.merge ? (banco.docs.get(ref.path) || {}) : {};
          banco.docs.set(ref.path, { ...clone(anterior), ...clone(value) });
        };
        return ref;
      },
      where: (campo, _operador, valor) => ({
        get: async () => ({
          docs: [...banco.docs]
            .filter(([path, value]) => path.startsWith(`${name}/`) && value?.[campo] === valor)
            .map(([path, value]) => ({ id: path.slice(name.length + 1), data: () => clone(value) })),
        }),
      }),
    };
  }

  snapshot(ref, docs = this.docs) {
    const value = docs.get(ref.path);
    return { ref, id: ref.id, exists: value !== undefined, data: () => clone(value) };
  }

  async getAll(...refs) {
    return refs.map((ref) => this.snapshot(ref));
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

function resposta() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(n, v) { this.headers[n] = v; },
    status(c) { this.statusCode = c; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; },
  };
}

const CPF = '39053344705';
const PEDIDO1 = 'SC-JP-300001';
const PEDIDO2 = 'SC-JP-300002';
const HORA = 60 * 60 * 1000;

function pedido(orderId, quantity = 1, paymentMethod = 'pix') {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: {
      orderId,
      items: [{ productId: 'p1', variantId: 'small', quantity }],
      country: 'Brasil',
      prefecture: '',
      state: 'SP',
      shippingCarrier: 'ems',
      paymentMethod,
      couponCode: '',
      redeemPoints: 0,
      negotiationId: '',
      promoCode: '',
      customer: {
        name: 'Cliente Teste', email: 'cliente@exemplo.com', phone: '', cpf: CPF,
        postalCode: '01310-100', city: 'Sao Paulo', address: 'Av Paulista 1000', building: '',
      },
    },
  };
}

function banco(overrides = {}) {
  return new FakeDb({
    // Só 1 unidade em estoque — exatamente o cenário do dono da loja: card
    // resolve em segundos, pix/wise só confirma depois, os dois disputam a
    // mesma última unidade.
    'products/p1': { name: 'Produto', prices: { small: 10000 }, weightGrams: 500, stock: { unlimited: false, quantity: 1 } },
    'users/u1': { email: 'cliente@exemplo.com', points: 0 },
    // `pix` está em TOGGLEABLE_PAYMENT_METHODS (orders.js) — sem este doc a
    // rota recusa com 503 antes de chegar na reserva de estoque sob teste.
    'settings/payments': { pixEnabled: true },
    ...overrides,
  });
}

beforeEach(() => {
  mocks.limitar.mockReset().mockResolvedValue(undefined);
  mocks.verify.mockReset().mockResolvedValue({ uid: 'u1', email: 'cliente@exemplo.com', email_verified: true });
  injected.db = null;
});

describe('reserva de estoque comum (produto fora da promoção da home)', () => {
  it('recusa o segundo checkout quando a última unidade já está reservada por outro pedido pendente', async () => {
    const agora = Date.now();
    injected.db = banco({
      'stock_reserve/p1': { holds: [{ orderId: 'SC-JP-999999', quantity: 1, expiresAt: agora + 24 * HORA }] },
    });

    const res = resposta();
    await handleCreate(pedido(PEDIDO1), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'insufficient_stock' });
    expect(injected.db.get(`orders/${PEDIDO1}`)).toBeUndefined();
    // Hold do pedido concorrente continua de pé — perder a disputa não pode
    // roubar a unidade de quem chegou primeiro.
    const estadoApos = injected.db.get('stock_reserve/p1');
    expect(estadoApos.holds).toHaveLength(1);
    expect(estadoApos.holds[0].orderId).toBe('SC-JP-999999');
  });

  it('primeiro checkout na última unidade grava a reserva e cria o pedido', async () => {
    injected.db = banco();

    const res = resposta();
    await handleCreate(pedido(PEDIDO1), res);

    expect(res.statusCode).toBe(201);
    expect(injected.db.get(`orders/${PEDIDO1}`)).toBeDefined();
    const estadoApos = injected.db.get('stock_reserve/p1');
    expect(estadoApos.holds).toHaveLength(1);
    expect(estadoApos.holds[0]).toMatchObject({ orderId: PEDIDO1, quantity: 1 });
  });

  it('hold vencido não bloqueia um novo checkout', async () => {
    const agora = Date.now();
    injected.db = banco({
      'stock_reserve/p1': { holds: [{ orderId: 'SC-JP-999999', quantity: 1, expiresAt: agora - HORA }] },
    });

    const res = resposta();
    await handleCreate(pedido(PEDIDO1), res);

    expect(res.statusCode).toBe(201);
    const estadoApos = injected.db.get('stock_reserve/p1');
    expect(estadoApos.holds).toHaveLength(1);
    expect(estadoApos.holds[0].orderId).toBe(PEDIDO1);
  });

  it('libera a reserva quando o pedido cai em payment_review', async () => {
    const agora = Date.now();
    injected.db = banco({
      'stock_reserve/p1': { holds: [{ orderId: PEDIDO1, quantity: 1, expiresAt: agora + HORA }] },
      [`orders/${PEDIDO1}`]: {
        userId: 'u1',
        cpf: CPF,
        items: [{ productId: 'p1', quantity: 1 }],
        status: 'pending_payment',
      },
    });

    const { markFulfillmentReview } = await import('./fulfillment.js');
    await markFulfillmentReview(PEDIDO1, 'test_reason');

    const estadoApos = injected.db.get('stock_reserve/p1');
    expect(estadoApos.holds).toHaveLength(0);
  });

  it('libera a reserva e decrementa o estoque de verdade quando o pedido é confirmado (fulfillOrder)', async () => {
    const agora = Date.now();
    injected.db = banco({
      'stock_reserve/p1': { holds: [{ orderId: PEDIDO1, quantity: 1, expiresAt: agora + HORA }] },
      [`orders/${PEDIDO1}`]: {
        userId: 'u1',
        cpf: CPF,
        customerEmail: 'cliente@exemplo.com',
        items: [{ productId: 'p1', quantity: 1 }],
        status: 'pending_payment',
        fulfillmentState: 'pending',
      },
    });

    const { fulfillOrder } = await import('./fulfillment.js');
    const result = await fulfillOrder(PEDIDO1, { provider: 'manual', reference: `pix:${PEDIDO1}`, confirmedBy: 'admin' });

    expect(result.replay).toBe(false);
    // Baixa de verdade no estoque.
    expect(injected.db.get('products/p1').stock.quantity).toBe(0);
    // Reserva não fica contada em dobro: some assim que vira baixa real.
    const estadoApos = injected.db.get('stock_reserve/p1');
    expect(estadoApos.holds).toHaveLength(0);
  });

  // A CORRIDA de verdade — a razão de este fix existir. Sem a revalidação
  // transacional, os dois checkouts leriam "sobra 1" na cotação (fora de
  // transação) e os dois passariam, deixando o segundo morrer só na hora de
  // `fulfillOrder`, com o cliente já tendo pago via PIX/Wise.
  it('recusa quando a última unidade é tomada entre a checagem inicial e a transação', async () => {
    const db = banco({ 'stock_reserve/p1': { holds: [] } });

    // O concorrente fecha a compra no instante em que a transação começa.
    const runTransactionOriginal = db.runTransaction.bind(db);
    db.runTransaction = (callback) => {
      db.docs.set('stock_reserve/p1', {
        holds: [{ orderId: 'SC-JP-399999', quantity: 1, expiresAt: Date.now() + HORA }],
      });
      return runTransactionOriginal(callback);
    };
    injected.db = db;

    const res = resposta();
    await handleCreate(pedido(PEDIDO2), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'insufficient_stock' });
    expect(db.get(`orders/${PEDIDO2}`)).toBeUndefined();
    const estadoApos = db.get('stock_reserve/p1');
    expect(estadoApos.holds).toHaveLength(1);
    expect(estadoApos.holds[0].orderId).toBe('SC-JP-399999');
  });

  it('produto com estoque ilimitado nunca cria reserva nem é bloqueado', async () => {
    injected.db = banco({
      'products/p1': { name: 'Produto', prices: { small: 10000 }, weightGrams: 500, stock: { unlimited: true } },
    });

    const res = resposta();
    await handleCreate(pedido(PEDIDO1), res);

    expect(res.statusCode).toBe(201);
    expect(injected.db.get('stock_reserve/p1')).toBeUndefined();
  });
});
