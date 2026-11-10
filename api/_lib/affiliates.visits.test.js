import { beforeEach, describe, expect, it, vi } from 'vitest';

// Retorno do divulgador: cada pessoa que chega pelo link ou digita o código
// conta uma única vez por código.
const mocks = vi.hoisted(() => ({ limit: vi.fn(), user: null, docs: {} }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', () => ({ requireUser: async () => mocks.user, requireAdmin: async () => mocks.user }));
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => {
    const ref = (path) => ({ path });
    const read = async ({ path }) => ({
      exists: path in mocks.docs,
      data: () => structuredClone(mocks.docs[path]),
    });
    return {
      collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
      runTransaction: async (work) => work({
        get: read,
        set: ({ path }, data) => { mocks.docs[path] = data; },
        update: ({ path }, data) => { mocks.docs[path] = { ...mocks.docs[path], ...data }; },
      }),
    };
  },
}));

const { default: handler } = await import('../affiliates.js');

async function visit(body, headers = {}) {
  const res = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
  await handler({ method: 'POST', headers, body: { action: 'track-visit', ...body } }, res);
  return res;
}

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.user = null;
  mocks.docs = {
    'affiliates/DIVULGADOR1FINO': { kind: 'promoter', active: true, ownerEmail: 'div@example.com', productId: 'fino' },
    'affiliates/OFF': { kind: 'promoter', active: false, ownerEmail: 'div@example.com' },
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('contagem de visitas por código', () => {
  it('conta cada visitante uma vez e separa link de código', async () => {
    expect((await visit({ code: 'divulgador1fino', source: 'link', visitorId: 'visitante-aaa' })).body).toEqual({ counted: true });
    expect((await visit({ code: 'DIVULGADOR1FINO', source: 'link', visitorId: 'visitante-aaa' })).body).toEqual({ counted: false });
    expect((await visit({ code: 'DIVULGADOR1FINO', source: 'code', visitorId: 'visitante-bbb' })).body).toEqual({ counted: true });

    expect(mocks.docs['affiliates/DIVULGADOR1FINO']).toMatchObject({ visitCount: 2, linkVisits: 1, codeVisits: 1 });
  });

  it('conta logada conta por pessoa, mesmo em outro navegador', async () => {
    mocks.user = { uid: 'u1', email: 'cliente@example.com' };
    const headers = { authorization: 'Bearer token' };
    await visit({ code: 'DIVULGADOR1FINO', source: 'link', visitorId: 'navegador-1' }, headers);
    await visit({ code: 'DIVULGADOR1FINO', source: 'link', visitorId: 'navegador-2' }, headers);
    expect(mocks.docs['affiliates/DIVULGADOR1FINO'].visitCount).toBe(1);
  });

  it('não conta o próprio divulgador, código inativo ou inexistente', async () => {
    expect((await visit({ code: 'OFF', source: 'link', visitorId: 'visitante-aaa' })).body).toEqual({ counted: false });
    expect((await visit({ code: 'NOPE', source: 'link', visitorId: 'visitante-aaa' })).body).toEqual({ counted: false });
    mocks.user = { uid: 'dono', email: 'Div@example.com' };
    expect((await visit({ code: 'DIVULGADOR1FINO', source: 'link', visitorId: 'visitante-ccc' }, { authorization: 'Bearer token' })).body)
      .toEqual({ counted: false });
    expect(mocks.docs['affiliates/DIVULGADOR1FINO'].visitCount).toBeUndefined();
  });

  it('recusa id de visitante inválido e campos extras', async () => {
    expect((await visit({ code: 'DIVULGADOR1FINO', source: 'link', visitorId: 'a/b' })).statusCode).toBe(400);
    expect((await visit({ code: 'DIVULGADOR1FINO', source: 'link', visitorId: 'visitante-aaa', ownerEmail: 'x' })).statusCode).toBe(400);
  });
});
