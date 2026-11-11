// Comprar sem cadastro dependia do login anônimo do Firebase; com ele desligado no projeto
// (`ADMIN_ONLY_OPERATION`) nenhum convidado conseguia cotar nem finalizar. O servidor passa a
// emitir um token de convidado que o navegador troca por uma sessão.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ limitar: vi.fn(), createCustomToken: vi.fn() }));

vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limitar }));
vi.mock('./firebase-admin.js', () => ({
  adminAuth: () => ({ createCustomToken: mocks.createCustomToken }),
  adminDb: () => ({}),
}));
vi.mock('./mailer.js', async (importOriginal) => ({ ...(await importOriginal()), sendMail: vi.fn() }));

const { handleGuestToken } = await import('../orders.js');
const { HttpError } = await import('./http.js');

function resposta() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(n, v) { this.headers[n] = v; },
    status(c) { this.statusCode = c; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; },
  };
}

describe('POST /api/guest-token', () => {
  beforeEach(() => {
    mocks.limitar.mockReset().mockResolvedValue(undefined);
    mocks.createCustomToken.mockReset().mockResolvedValue('token-assinado');
  });

  it('emite um token para um uid de convidado novo, com a marca `guest`', async () => {
    const res = resposta();
    await handleGuestToken({ method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.9' }, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, token: 'token-assinado' });
    const [uid, claims] = mocks.createCustomToken.mock.calls[0];
    expect(uid).toMatch(/^guest_[0-9a-f-]{36}$/);
    expect(claims).toEqual({ guest: true });
  });

  it('cada chamada gera um uid diferente', async () => {
    await handleGuestToken({ method: 'POST', headers: {}, body: {} }, resposta());
    await handleGuestToken({ method: 'POST', headers: {}, body: {} }, resposta());
    const [a, b] = mocks.createCustomToken.mock.calls.map((c) => c[0]);
    expect(a).not.toBe(b);
  });

  it('limita por IP (o limite é por endereço, não global)', async () => {
    await handleGuestToken({ method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.9' }, body: {} }, resposta());
    expect(mocks.limitar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'guest-token', identity: 'ip:203.0.113.9' }));
  });

  it('acima do limite devolve 429 e não emite token', async () => {
    mocks.limitar.mockRejectedValue(new HttpError(429, 'rate_limited'));
    const res = resposta();
    await handleGuestToken({ method: 'POST', headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(429);
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it('só aceita POST', async () => {
    const res = resposta();
    await handleGuestToken({ method: 'GET', headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });
});
