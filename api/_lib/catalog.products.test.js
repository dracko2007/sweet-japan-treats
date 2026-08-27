import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminDb: vi.fn(),
}));

vi.mock('./firebase-admin.js', () => ({ adminDb: mocks.adminDb }));
vi.mock('./http.js', () => ({
  handleCors: () => true,
  HttpError: class HttpError extends Error {},
  sendError: (res, err) => res.status(500).json({ error: String(err) }),
}));
vi.mock('../_handlers/geo.js', () => ({ default: vi.fn() }));
vi.mock('../_handlers/product-enrich.js', () => ({ default: vi.fn() }));
vi.mock('../_handlers/sitemap.js', () => ({ default: vi.fn() }));
vi.mock('../_handlers/wise-rate.js', () => ({ default: vi.fn() }));

import catalog from '../catalog.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

function fakeSnapshot(docs) {
  return {
    docs: docs.map(([id, data]) => ({ id, data: () => data })),
  };
}

function fakeCollection(docs) {
  return {
    where: () => fakeCollection(docs),
    get: async () => fakeSnapshot(docs),
  };
}

describe('GET /api/catalog?action=products', () => {
  beforeEach(() => {
    mocks.adminDb.mockReset();
  });

  it('adiciona produto recém-ocultado ao array `deleted`, não só o remove de `items`', async () => {
    // Um produto que já estava visível no cache do cliente foi marcado
    // `hidden: true`. A sincronização incremental (`since=...`) precisa
    // avisar o cliente para apagá-lo do cache local — só excluí-lo de
    // `items` não é suficiente, pois o cache já tem a cópia visível antiga.
    mocks.adminDb.mockReturnValue({
      collection: () => fakeCollection([
        ['produto-ocultado', { name: 'X', hidden: true, updatedAt: { toMillis: () => 1000 } }],
      ]),
    });

    const req = { query: { action: 'products', since: '500' } };
    const res = response();
    await catalog(req, res);

    expect(res.body.items).toEqual([]);
    expect(res.body.deleted).toEqual(['produto-ocultado']);
  });

  it('produto realmente deletado (__deleted) continua indo para `deleted`', async () => {
    mocks.adminDb.mockReturnValue({
      collection: () => fakeCollection([
        ['produto-apagado', { __deleted: true, updatedAt: { toMillis: () => 1000 } }],
      ]),
    });

    const res = response();
    await catalog({ query: { action: 'products', since: '500' } }, res);

    expect(res.body.deleted).toEqual(['produto-apagado']);
  });

  it('produto visível normal continua indo para `items`', async () => {
    mocks.adminDb.mockReturnValue({
      collection: () => fakeCollection([
        ['produto-visivel', { name: 'Y', image: 'https://x/y.jpg', updatedAt: { toMillis: () => 1000 } }],
      ]),
    });

    const res = response();
    await catalog({ query: { action: 'products' } }, res);

    expect(res.body.deleted).toEqual([]);
    expect(res.body.items).toEqual([{ id: 'produto-visivel', name: 'Y', image: 'https://x/y.jpg' }]);
  });
});
