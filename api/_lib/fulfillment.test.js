import { beforeEach, describe, expect, it, vi } from 'vitest';

const injected = vi.hoisted(() => ({ db: null }));
const mocks = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('./firebase-admin.js', () => ({ adminDb: () => injected.db }));
vi.mock('./mailer.js', async (importOriginal) => ({
  // O template real vai junto: se ele quebrar, o teste do aviso quebra também.
  // Só o envio é trocado, que é o que depende de rede.
  ...(await importOriginal()),
  sendMail: mocks.sendMail,
}));

const { fulfillOrder, markFulfillmentReview } = await import('./fulfillment.js');

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

  // `markFulfillmentReview` lê e escreve FORA de transação, direto no doc ref.
  // O fake precisa dos dois modos para cobrir os dois caminhos do arquivo.
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
    };
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

  it('bloqueia novo 30% na mesma transação que confirma a compra', async () => {
    const paidWith30 = order('O1', { couponDiscountYen: 300 });
    const db = database(paidWith30);
    injected.db = db;
    await fulfillOrder('O1', { provider: 'manual', reference: 'cupom30', confirmedBy: 'admin' });
    expect(db.get('cart_recovery_profiles/user-O1')).toMatchObject({
      blockedFrom30: true,
      lastDiscountPercent: 30,
    });
  });

  it('só libera o 30% quando a compra usa menos de 15%', async () => {
    const paidWith10 = order('O1', { couponDiscountYen: 100 });
    const db = database(paidWith10, 2, {
      'cart_recovery_profiles/user-O1': { blockedFrom30: true, lastDiscountPercent: 30 },
    });
    injected.db = db;
    await fulfillOrder('O1', { provider: 'manual', reference: 'cupom10', confirmedBy: 'admin' });
    expect(db.get('cart_recovery_profiles/user-O1').blockedFrom30).toBe(false);
  });

  it('desconto exatamente de 15% preserva o bloqueio', async () => {
    const paidWith15 = order('O1', { couponDiscountYen: 150 });
    const db = database(paidWith15, 2, {
      'cart_recovery_profiles/user-O1': { blockedFrom30: true, lastDiscountPercent: 30 },
    });
    injected.db = db;
    await fulfillOrder('O1', { provider: 'manual', reference: 'cupom15', confirmedBy: 'admin' });
    expect(db.get('cart_recovery_profiles/user-O1')).toMatchObject({
      blockedFrom30: true,
      lastDiscountPercent: 15,
    });
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

// Regressão do ALTO 1 do AUDITORIA.md: o pedido era cobrado, o `fulfillOrder`
// recusava, e o estado virava `payment_review` sem avisar ninguém e sem deixar
// registrado o que estornar. O cliente descobria esperando; a loja, no
// chargeback.
describe('pedido pago que não pôde ser separado', () => {
  const cobranca = { paymentIntentId: 'pi_123', amount: 114, currency: 'BRL' };

  beforeEach(() => {
    mocks.sendMail.mockReset().mockResolvedValue({});
    process.env.ORDER_NOTIFICATION_EMAIL = 'loja@example.com';
  });

  it('deixa o pedido pronto para estorno', async () => {
    const db = database(order('O1', { totalPrice: 114, currency: 'BRL' }));
    injected.db = db;

    await markFulfillmentReview('O1', 'insufficient_stock', cobranca);

    expect(db.get('orders/O1')).toMatchObject({
      status: 'payment_review',
      fulfillmentState: 'review',
      fulfillmentError: 'insufficient_stock',
      refundPending: true,
      refundReference: 'pi_123',
      refundAmount: 114,
      refundCurrency: 'BRL',
    });
  });

  it('avisa o cliente e a loja', async () => {
    injected.db = database(order('O1', { totalPrice: 114, currency: 'BRL' }));

    const { notified } = await markFulfillmentReview('O1', 'insufficient_stock', cobranca);

    expect(notified).toBe(true);
    const destinatarios = mocks.sendMail.mock.calls.map((c) => c[0].to);
    expect(destinatarios).toEqual(['o1@example.com', 'loja@example.com']);

    // O cliente não pode receber jargão nem promessa que a loja talvez não
    // cumpra; a loja precisa do motivo exato e do caminho do estorno.
    const [aoCliente, aLoja] = mocks.sendMail.mock.calls.map((c) => c[0]);
    expect(aoCliente.subject).toContain('#O1');
    expect(aoCliente.html).not.toContain('insufficient_stock');
    expect(aLoja.subject).toContain('ACAO NECESSARIA');
    expect(aLoja.html).toContain('insufficient_stock');
    expect(aLoja.html).toContain('dashboard.stripe.com/payments/pi_123');
  });

  // O Stripe entrega evento "pelo menos uma vez". Sem trava, cada reentrega
  // mandaria outro par de e-mails sobre o mesmo pedido.
  it('não repete o aviso quando o mesmo evento chega de novo', async () => {
    injected.db = database(order('O1', { totalPrice: 114, currency: 'BRL' }));

    const primeira = await markFulfillmentReview('O1', 'insufficient_stock', cobranca);
    mocks.sendMail.mockClear();
    const segunda = await markFulfillmentReview('O1', 'insufficient_stock', cobranca);

    expect(primeira.notified).toBe(true);
    expect(segunda.notified).toBe(false);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  // SMTP fora do ar não pode virar 500 no webhook: o Stripe repetiria em cima
  // de um pedido que já está com problema.
  it('registra o estorno mesmo se o e-mail falhar', async () => {
    const db = database(order('O1', { totalPrice: 114, currency: 'BRL' }));
    injected.db = db;
    mocks.sendMail.mockRejectedValue(new Error('smtp fora do ar'));

    const { notified } = await markFulfillmentReview('O1', 'insufficient_stock', cobranca);

    expect(notified).toBe(false);
    expect(db.get('orders/O1')).toMatchObject({ refundPending: true, refundReference: 'pi_123' });
  });

  // Quando valor/moeda divergem, o pedido e a cobrança são coisas diferentes.
  // Vale o que saiu do cartão — é isso que precisa voltar.
  it('guarda o valor cobrado, não o valor do pedido', async () => {
    const db = database(order('O1', { totalPrice: 114, currency: 'BRL' }));
    injected.db = db;

    await markFulfillmentReview('O1', 'payment_amount_or_currency_mismatch', {
      paymentIntentId: 'pi_999', amount: 9999, currency: 'USD',
    });

    expect(db.get('orders/O1')).toMatchObject({ refundAmount: 9999, refundCurrency: 'USD' });
    // O e-mail da loja tem de anunciar o que saiu do cartão ($9999.00), nunca
    // o valor do pedido (R$ 114) — é o número que a pessoa vai estornar.
    expect(mocks.sendMail.mock.calls[1][0].html).toContain('$9999.00');
    expect(mocks.sendMail.mock.calls[1][0].html).not.toContain('114');
  });
});
