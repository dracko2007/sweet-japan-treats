import { beforeEach, describe, expect, it, vi } from 'vitest';

// Reviews dos divulgadores: o dono do código envia o link, o admin aprova e
// só os aprovados (sem e-mail) saem na lista pública do vlog.
const mocks = vi.hoisted(() => ({ limit: vi.fn(), user: null, admin: false, docs: {} }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', async () => {
  const { HttpError } = await import('./http.js');
  return {
    requireUser: async () => {
      if (!mocks.user) throw new HttpError(401, 'unauthenticated');
      return mocks.user;
    },
    requireAdmin: async () => {
      if (!mocks.admin) throw new HttpError(403, 'forbidden');
      return mocks.user;
    },
  };
});
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => ({
    collection: (name) => {
      const rows = (filter) => Object.entries(mocks.docs)
        .filter(([path, data]) => path.startsWith(`${name}/`) && filter(data))
        .map(([path, data]) => ({ id: path.slice(name.length + 1), data: () => structuredClone(data) }));
      return {
        doc: (id) => {
          const path = `${name}/${id}`;
          return {
            get: async () => ({ id, exists: path in mocks.docs, data: () => structuredClone(mocks.docs[path]) }),
            set: async (data) => { mocks.docs[path] = data; },
            update: async (data) => { mocks.docs[path] = { ...mocks.docs[path], ...data }; },
            delete: async () => { delete mocks.docs[path]; },
          };
        },
        where: (field, _op, value) => ({ get: async () => ({ docs: rows((data) => data[field] === value) }) }),
        get: async () => ({ docs: rows(() => true) }),
      };
    },
  }),
}));

const { default: handler } = await import('../affiliates.js');

async function call(body) {
  const res = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
  await handler({ method: 'POST', headers: {}, body }, res);
  return res;
}

const LINK = 'https://youtu.be/tYcA1j-fcKg';

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.user = { uid: 'u1', email: 'div@example.com' };
  mocks.admin = false;
  mocks.docs = {
    'affiliates/DIVULGADOR1FINO': { kind: 'promoter', active: true, ownerEmail: 'div@example.com', ownerName: 'Ana', productId: 'fino', productName: 'Fino Hair Mask' },
    'affiliates/OUTRO': { kind: 'promoter', active: true, ownerEmail: 'outra@example.com' },
  };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ title: 'Testei a Fino', thumbnail_url: 'https://i.ytimg.com/vi/x/hq.jpg' }) })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('reviews dos divulgadores', () => {
  it('envia o link como pendente, com produto do código e dados do oEmbed', async () => {
    const res = await call({ action: 'review-submit', code: 'divulgador1fino', url: LINK });
    expect(res.statusCode).toBe(200);
    expect(res.body.review).toMatchObject({
      code: 'DIVULGADOR1FINO', productId: 'fino', productName: 'Fino Hair Mask', platform: 'youtube',
      videoId: 'tYcA1j-fcKg', title: 'Testei a Fino', status: 'pending',
    });
    expect(res.body.review).not.toHaveProperty('ownerEmail');
    expect(fetch.mock.calls[0][0]).toContain('https://www.youtube.com/oembed?');
  });

  it('recusa código de outra pessoa, link de fora e envio repetido', async () => {
    expect((await call({ action: 'review-submit', code: 'OUTRO', url: LINK })).statusCode).toBe(403);
    const fora = await call({ action: 'review-submit', code: 'DIVULGADOR1FINO', url: 'https://example.com/video' });
    expect(fora.body).toEqual({ error: 'invalid_review_url' });
    await call({ action: 'review-submit', code: 'DIVULGADOR1FINO', url: LINK });
    expect((await call({ action: 'review-submit', code: 'DIVULGADOR1FINO', url: `${LINK}?si=x` })).body).toEqual({ error: 'review_already_sent' });
  });

  it('entra mesmo se o oEmbed falhar', async () => {
    fetch.mockRejectedValue(new Error('timeout'));
    const res = await call({ action: 'review-submit', code: 'DIVULGADOR1FINO', url: 'https://www.instagram.com/reel/Cxyz_123/' });
    expect(res.body.review).toMatchObject({ platform: 'instagram', title: '', status: 'pending' });
    expect(fetch).not.toHaveBeenCalled(); // Instagram não tem oEmbed público
  });

  it('só o admin modera, e a lista pública só traz aprovados', async () => {
    const { review } = (await call({ action: 'review-submit', code: 'DIVULGADOR1FINO', url: LINK })).body;
    mocks.user = null; // visitante
    expect((await call({ action: 'review-list' })).body).toEqual({ reviews: [] });

    mocks.user = { uid: 'u1', email: 'div@example.com' };
    expect((await call({ action: 'review-moderate', id: review.id, status: 'approved' })).statusCode).toBe(403);
    expect((await call({ action: 'review-admin-list' })).statusCode).toBe(403);

    mocks.admin = true;
    expect((await call({ action: 'review-moderate', id: review.id, status: 'approved' })).body).toEqual({ ok: true });
    expect((await call({ action: 'review-admin-list' })).body.reviews[0]).toMatchObject({ ownerEmail: 'div@example.com', status: 'approved' });

    mocks.user = null;
    const publico = (await call({ action: 'review-list' })).body.reviews;
    expect(publico).toHaveLength(1);
    expect(JSON.stringify(publico)).not.toContain('div@example.com');

    mocks.user = { uid: 'u1', email: 'div@example.com' };
    expect((await call({ action: 'review-mine' })).body.reviews).toHaveLength(1);
    await call({ action: 'review-moderate', id: review.id, status: 'deleted' });
    expect((await call({ action: 'review-mine' })).body.reviews).toHaveLength(0);
  });
});

describe('reviews: produto, vídeo fora do ar e compras por código', () => {
  const aprovar = async (url) => {
    const { review } = (await call({ action: 'review-submit', code: 'DIVULGADOR1FINO', url })).body;
    mocks.admin = true;
    await call({ action: 'review-moderate', id: review.id, status: 'approved' });
    mocks.admin = false;
    return review;
  };

  it('a página do produto recebe só os reviews daquele produto', async () => {
    await aprovar(LINK);
    expect((await call({ action: 'review-list', productId: 'fino' })).body.reviews).toHaveLength(1);
    expect((await call({ action: 'review-list', productId: 'outro' })).body.reviews).toHaveLength(0);
  });

  it('esconde o vídeo apagado na rede e devolve quando ele volta', async () => {
    const review = await aprovar(LINK);
    mocks.admin = true;
    fetch.mockResolvedValue({ ok: false, status: 404 });
    expect((await call({ action: 'review-check' })).body).toEqual({ checked: 1, hidden: 1, restored: 0 });
    expect((await call({ action: 'review-list' })).body.reviews).toHaveLength(0);

    fetch.mockRejectedValue(new Error('timeout')); // sem resposta não muda nada
    expect((await call({ action: 'review-check' })).body).toMatchObject({ hidden: 0, restored: 0 });

    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    expect((await call({ action: 'review-check' })).body).toMatchObject({ restored: 1 });
    expect((await call({ action: 'review-list' })).body.reviews[0].id).toBe(review.id);

    mocks.admin = false;
    expect((await call({ action: 'review-check' })).statusCode).toBe(403);
  });

  it('conta compras pelos pedidos pagos e ignora cancelados', async () => {
    Object.assign(mocks.docs, {
      'orders/O1': { id: 'O1', affiliateCode: 'DIVULGADOR1FINO', paymentConfirmed: true, status: 'confirmed', netProductsYen: 3000, customerName: 'Maria', paymentConfirmedAt: '2026-11-02' },
      'orders/O2': { id: 'O2', affiliateCode: 'DIVULGADOR1FINO', paymentConfirmed: true, status: 'cancelled', netProductsYen: 9000 },
      'orders/O3': { id: 'O3', affiliateCode: 'DIVULGADOR1FINO', paymentConfirmed: false, status: 'pending_payment', netProductsYen: 5000 },
      'orders/O4': { id: 'O4', affiliateCode: 'OUTRO', paymentConfirmed: true, status: 'confirmed', netProductsYen: 1000 },
    });
    const dono = (await call({ action: 'promoter-orders' })).body.orders;
    expect(Object.keys(dono)).toEqual(['DIVULGADOR1FINO']);
    expect(dono.DIVULGADOR1FINO).toEqual({ count: 1, revenueYen: 3000, orders: [{ date: '2026-11-02', netYen: 3000 }] });

    expect((await call({ action: 'promoter-orders', admin: true })).statusCode).toBe(403);
    mocks.admin = true;
    const loja = (await call({ action: 'promoter-orders', admin: true })).body.orders;
    expect(Object.keys(loja).sort()).toEqual(['DIVULGADOR1FINO', 'OUTRO']);
    expect(loja.DIVULGADOR1FINO.orders[0]).toMatchObject({ orderId: 'O1', customerName: 'Maria' });
  });
});
