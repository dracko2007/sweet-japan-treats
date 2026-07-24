import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminAuth: {
    createCustomToken: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
  },
  adminDb: {
    collection: vi.fn(),
    batch: vi.fn(),
  },
}));

vi.mock('./_lib/firebase-admin.js', () => ({
  adminAuth: () => mocks.adminAuth,
  adminDb: () => mocks.adminDb,
}));

vi.mock('./_lib/rate-limit.js', () => ({
  enforceRateLimit: vi.fn(),
}));

import { handleSession as adminSessionHandler } from './admin.js';

function mockReq(method, body, headers = {}) {
  return {
    method,
    headers: { origin: 'https://japanexpress-store.com', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
  };
  return res;
}

/** Mocks `db.collection('admins')` for the "migrated" (already Firebase-backed) lookup. */
function mockMigratedQuery({ empty, doc } = { empty: true }) {
  return {
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => (empty
          ? { empty: true, docs: [] }
          : { empty: false, docs: [{ id: doc.id, data: () => doc.data }] })),
      })),
    })),
    doc: vi.fn(),
  };
}

describe('admin-session endpoint (sub-admin auth only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminAuth.createCustomToken.mockResolvedValue('custom-token-abc');
    process.env.FIREBASE_WEB_API_KEY = 'fake-key';
    globalThis.fetch = vi.fn();
  });

  it('rejects GET method', async () => {
    const req = mockReq('GET', null);
    const res = mockRes();
    await adminSessionHandler(req, res);
    expect([405, 403]).toContain(res.statusCode);
  });

  it('rejects unknown username with 401 (no migrated or legacy record)', async () => {
    mocks.adminDb.collection.mockImplementation((name) => {
      expect(name).toBe('admins');
      return {
        where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn(async () => ({ empty: true, docs: [] })) })) })),
        doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })),
      };
    });
    const req = mockReq('POST', { identifier: 'ghost', password: 'whatever' });
    const res = mockRes();
    await adminSessionHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('authenticates an already-migrated sub-admin and returns a custom token', async () => {
    const doc = { id: 'uid-migrated', data: { username: 'joao', authEmail: 'admin-x@auth.japanexpress-store.com', active: true, name: 'Joao', role: 2 } };
    mocks.adminDb.collection.mockReturnValue(mockMigratedQuery({ empty: false, doc }));
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ localId: 'uid-migrated' }) });

    const req = mockReq('POST', { identifier: 'joao', password: 'correct-password' });
    const res = mockRes();
    await adminSessionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.customToken).toBe('custom-token-abc');
    expect(res.body.admin.role).toBe(2);
  });

  it('rejects a migrated sub-admin when the Identity Toolkit UID does not match the stored doc id (impersonation guard)', async () => {
    const doc = { id: 'uid-migrated', data: { username: 'joao', authEmail: 'admin-x@auth.japanexpress-store.com', active: true, name: 'Joao', role: 2 } };
    mocks.adminDb.collection.mockReturnValue(mockMigratedQuery({ empty: false, doc }));
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ localId: 'someone-else-uid' }) });

    const req = mockReq('POST', { identifier: 'joao', password: 'correct-password' });
    const res = mockRes();
    await adminSessionHandler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects a deactivated migrated sub-admin', async () => {
    const doc = { id: 'uid-migrated', data: { username: 'joao', authEmail: 'admin-x@auth.japanexpress-store.com', active: false, name: 'Joao', role: 1 } };
    mocks.adminDb.collection.mockReturnValue(mockMigratedQuery({ empty: false, doc }));

    const req = mockReq('POST', { identifier: 'joao', password: 'whatever' });
    const res = mockRes();
    await adminSessionHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('migrates a legacy plaintext-password sub-admin on first login and returns a custom token', async () => {
    const legacyDoc = { active: true, password: 'legacy-plain-pass', name: 'Legacy Joao', role: 1, addedAt: '2024-01-01' };
    const legacyGet = vi.fn(async () => ({ exists: true, data: () => legacyDoc }));
    const newDocSet = vi.fn();
    const batch = { set: newDocSet, delete: vi.fn(), commit: vi.fn(async () => undefined) };

    mocks.adminDb.collection.mockImplementation(() => ({
      where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn(async () => ({ empty: true, docs: [] })) })) })),
      doc: vi.fn((id) => ({ get: legacyGet, path: `admins/${id}` })),
    }));
    mocks.adminDb.batch.mockReturnValue(batch);
    mocks.adminAuth.createUser.mockResolvedValue(undefined);

    const req = mockReq('POST', { identifier: 'legacy-joao', password: 'legacy-plain-pass' });
    const res = mockRes();
    await adminSessionHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.customToken).toBe('custom-token-abc');
    expect(mocks.adminAuth.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.adminAuth.setCustomUserClaims).toHaveBeenCalledTimes(1);
    // Never persists the plaintext password in the new admin record.
    const persisted = newDocSet.mock.calls[0][1];
    expect(persisted.password).toBeUndefined();
  });

  it('rejects a legacy sub-admin with the wrong password without creating a Firebase user', async () => {
    const legacyDoc = { active: true, password: 'real-password', name: 'Legacy Joao', role: 1 };
    mocks.adminDb.collection.mockImplementation(() => ({
      where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn(async () => ({ empty: true, docs: [] })) })) })),
      doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: true, data: () => legacyDoc })) })),
    }));

    const req = mockReq('POST', { identifier: 'legacy-joao', password: 'wrong-password' });
    const res = mockRes();
    await adminSessionHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(mocks.adminAuth.createUser).not.toHaveBeenCalled();
  });
});
