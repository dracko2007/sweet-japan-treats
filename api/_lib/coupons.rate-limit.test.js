import { beforeEach, describe, expect, it, vi } from 'vitest';

// A validação de cupom diz se o código existe. Sem limite, dava para testar
// códigos em série até achar um.
const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  user: null,
  reads: vi.fn(),
}));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', () => ({ requireUser: async () => mocks.user }));
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => {
          mocks.reads();
          return { exists: false };
        },
      }),
    }),
  }),
}));

const { default: handler } = await import('../coupons.js');
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

async function check(headers = {}) {
  const res = response();
  await handler({ method: 'POST', headers, body: { code: 'PROMO10', orderTotalYen: 3000 } }, res);
  return res;
}

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.reads.mockReset();
  mocks.user = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('coupon check rate limit', () => {
  it('counts a signed-in customer by account', async () => {
    mocks.user = { uid: 'u1', email: 'u1@example.com', email_verified: true };

    await check({ authorization: 'Bearer token' });

    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      scope: 'coupon-check',
      identity: 'u1',
    }));
  });

  it('counts a guest by IP', async () => {
    await check();

    const [, options] = mocks.limit.mock.calls[0];
    expect(options.scope).toBe('coupon-check:guest');
    expect(options.identity).toBeUndefined();
  });

  it('stops before looking the code up', async () => {
    mocks.limit.mockRejectedValue(new HttpError(429, 'rate_limited'));

    const res = await check();

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ error: 'rate_limited' });
    expect(mocks.reads).not.toHaveBeenCalled();
  });
});
