import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; isAnonymous: boolean; getIdToken: () => Promise<string> } },
  signInAnonymously: vi.fn(),
  signInWithCustomToken: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: mocks.signInAnonymously,
  signInWithCustomToken: mocks.signInWithCustomToken,
}));
vi.mock('@/config/firebase', () => ({ auth: mocks.auth }));

const user = (uid: string, isAnonymous = false) => ({ uid, isAnonymous, getIdToken: async () => `id-token-${uid}` });

describe('checkoutToken: comprar sem cadastro', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.auth.currentUser = null;
    mocks.signInAnonymously.mockReset();
    mocks.signInWithCustomToken.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('usa o login anônimo do Firebase quando ele está ligado', async () => {
    mocks.signInAnonymously.mockResolvedValue({ user: user('anon-1', true) });
    const { checkoutToken } = await import('./checkoutService');
    expect(await checkoutToken()).toBe('id-token-anon-1');
    expect(mocks.signInWithCustomToken).not.toHaveBeenCalled();
  });

  it('com o login anônimo desligado, entra com o token de convidado do servidor', async () => {
    mocks.signInAnonymously.mockRejectedValue(Object.assign(new Error('admin-restricted-operation'), { code: 'auth/admin-restricted-operation' }));
    mocks.signInWithCustomToken.mockResolvedValue({ user: user('guest_abc') });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, token: 'custom-token' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { checkoutToken } = await import('./checkoutService');

    expect(await checkoutToken()).toBe('id-token-guest_abc');
    expect(fetchMock).toHaveBeenCalledWith('/api/guest-token', { method: 'POST' });
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith(mocks.auth, 'custom-token');
  });

  it('chamadas simultâneas (cotação + isenção) criam um convidado só, e a falha do anônimo é lembrada', async () => {
    mocks.signInAnonymously.mockRejectedValue(new Error('admin-restricted-operation'));
    mocks.signInWithCustomToken.mockResolvedValue({ user: user('guest_abc') });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, token: 'custom-token' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { checkoutToken } = await import('./checkoutService');

    await Promise.all([checkoutToken(), checkoutToken(), checkoutToken()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('já logado (conta ou convidado) reaproveita a sessão', async () => {
    mocks.auth.currentUser = user('guest_xyz');
    const { checkoutToken } = await import('./checkoutService');
    expect(await checkoutToken()).toBe('id-token-guest_xyz');
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it('servidor recusou o token: erro claro, sem sessão', async () => {
    mocks.signInAnonymously.mockRejectedValue(new Error('admin-restricted-operation'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'rate_limited' }) }));
    const { checkoutToken } = await import('./checkoutService');
    await expect(checkoutToken()).rejects.toMatchObject({ code: 'rate_limited' });
    expect(mocks.signInWithCustomToken).not.toHaveBeenCalled();
  });

  it('isGuestUser reconhece anônimo e o convidado do servidor, mas não conta registrada', async () => {
    const { isGuestUser } = await import('./checkoutService');
    expect(isGuestUser({ uid: 'x', isAnonymous: true })).toBe(true);
    expect(isGuestUser({ uid: 'guest_1', isAnonymous: false })).toBe(true);
    expect(isGuestUser({ uid: 'Zx81kQ', isAnonymous: false })).toBe(false);
    expect(isGuestUser(null)).toBe(false);
  });
});
