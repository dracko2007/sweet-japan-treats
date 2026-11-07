import { beforeEach, describe, expect, it, vi } from 'vitest';

// O carrinho valida o código de afiliado pelo servidor: a resposta nunca pode
// trazer e-mail, ganhos ou vendas do afiliado (antes o navegador lia o doc inteiro).
const mocks = vi.hoisted(() => ({ limit: vi.fn(), user: null, docs: {}, reads: vi.fn() }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', () => ({ requireUser: async () => mocks.user, requireAdmin: async () => mocks.user }));
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => ({
    collection: () => ({
      doc: (id) => ({
        get: async () => {
          mocks.reads(id);
          const data = mocks.docs[id];
          return { id, exists: !!data, data: () => (data ? structuredClone(data) : undefined) };
        },
      }),
    }),
  }),
}));

const { default: handler } = await import('../affiliates.js');
const { HttpError } = await import('./http.js');

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

async function validate(code, headers = {}) {
  const res = response();
  await handler({ method: 'POST', headers, body: { action: 'validate', code } }, res);
  return res;
}

const affiliate = (over = {}) => ({
  ownerEmail: 'secret@example.com',
  ownerName: 'Ana Influencer',
  discountPercent: 10,
  commissionPercent: 15,
  active: true,
  expiresAt: '2099-01-01T00:00:00.000Z',
  totalOrders: 7,
  totalRevenue: 70000,
  totalEarnings: 10500,
  ...over,
});

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.reads.mockReset();
  mocks.user = null;
  mocks.docs = { ANA10: affiliate(), OFF: affiliate({ active: false }), OLD: affiliate({ expiresAt: '2020-01-01T00:00:00.000Z' }) };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('affiliate code validation', () => {
  it('works for a guest and returns only what the cart shows', async () => {
    const res = await validate('ana10');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      valid: true,
      affiliate: { code: 'ANA10', ownerName: 'Ana Influencer', discountPercent: 10, expiresAt: '2099-01-01T00:00:00.000Z' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secret@example\.com|totalEarnings|totalRevenue|commission/);
    expect(mocks.reads).toHaveBeenCalledWith('ANA10');
  });

  it('says why a code cannot be used', async () => {
    expect((await validate('NOPE')).body).toEqual({ valid: false, reason: 'not_found' });
    expect((await validate('OFF')).body).toEqual({ valid: false, reason: 'inactive' });
    expect((await validate('OLD')).body).toEqual({ valid: false, reason: 'expired' });
  });

  it('counts guests by IP and signed-in customers by account', async () => {
    await validate('ANA10');
    expect(mocks.limit.mock.calls[0][1]).toMatchObject({ scope: 'affiliate-validate:guest' });
    expect(mocks.limit.mock.calls[0][1].identity).toBeUndefined();

    mocks.user = { uid: 'u1', email: 'u1@example.com' };
    await validate('ANA10', { authorization: 'Bearer token' });
    expect(mocks.limit.mock.calls[1][1]).toMatchObject({ scope: 'affiliate-validate', identity: 'u1' });
  });

  it('stops before looking the code up when rate limited', async () => {
    mocks.limit.mockRejectedValue(new HttpError(429, 'rate_limited'));
    const res = await validate('ANA10');
    expect(res.statusCode).toBe(429);
    expect(mocks.reads).not.toHaveBeenCalled();
  });

  it('rejects ids Firestore cannot read and extra fields', async () => {
    expect((await validate('a/b')).statusCode).toBe(400);
    expect((await validate('..')).statusCode).toBe(400);
    const res = response();
    await handler({ method: 'POST', headers: {}, body: { action: 'validate', code: 'ANA10', ownerEmail: 'x' } }, res);
    expect(res.statusCode).toBe(400);
    expect(mocks.reads).not.toHaveBeenCalled();
  });
});
