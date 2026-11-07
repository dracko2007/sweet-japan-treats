import { beforeEach, describe, expect, it, vi } from 'vitest';

// Modo admin do assistente: mesma régua das regras do Firestore (registro
// ativo em admins/{uid}). Antes bastava o e-mail do token bater com ADMIN_EMAIL.
const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  adminRecord: null,
  adminReads: vi.fn(),
  limit: vi.fn(),
}));
vi.mock('./firebase-admin.js', () => ({
  adminAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
  adminDb: () => ({
    collection: () => ({
      doc: (id) => ({
        get: async () => {
          mocks.adminReads(id);
          return { exists: mocks.adminRecord !== null, data: () => mocks.adminRecord };
        },
      }),
    }),
  }),
}));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));

const { default: handler, verifyAdmin } = await import('../kimiclaw.js');
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

beforeEach(() => {
  mocks.verifyIdToken.mockReset();
  mocks.adminReads.mockReset();
  mocks.limit.mockReset();
  mocks.adminRecord = null;
});

describe('KimiClaw admin check', () => {
  it('accepts a token whose uid has an active admins record', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'a1', email: 'staff@example.com' });
    mocks.adminRecord = { active: true };

    await expect(verifyAdmin('token')).resolves.toBe(true);
    expect(mocks.adminReads).toHaveBeenCalledWith('a1');
  });

  it('refuses without an active record, even with the owner e-mail', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com';
    mocks.verifyIdToken.mockResolvedValue({ uid: 'x1', email: 'owner@example.com' });

    await expect(verifyAdmin('token')).resolves.toBe(false);
    mocks.adminRecord = { active: false };
    await expect(verifyAdmin('token')).resolves.toBe(false);
    delete process.env.ADMIN_EMAIL;
  });

  it('refuses an invalid or missing token', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('bad token'));
    await expect(verifyAdmin('forged')).resolves.toBe(false);
    await expect(verifyAdmin('')).resolves.toBe(false);
    await expect(verifyAdmin(undefined)).resolves.toBe(false);
    expect(mocks.adminReads).not.toHaveBeenCalled();
  });
});

describe('KimiClaw rate limit', () => {
  it('answers 429 from the shared limiter before calling any AI', async () => {
    mocks.limit.mockRejectedValue(new HttpError(429, 'rate_limited'));
    const res = response();

    await handler({ method: 'POST', headers: {}, body: { messages: [] } }, res);

    expect(res.statusCode).toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'kimiclaw' }));
  });

  it('does not call the AI when the limiter is unavailable', async () => {
    mocks.limit.mockRejectedValue(new HttpError(503, 'rate_limit_unavailable'));
    const res = response();

    await handler({ method: 'POST', headers: {}, body: { messages: [] } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'rate_limit_unavailable' });
  });
});
