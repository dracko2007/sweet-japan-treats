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

import catalog, { resetCatalogCache } from '../catalog.js';

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
    resetCatalogCache();
    vi.useRealTimers();
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

  // Primeira visita relê o catálogo inteiro. Numa onda de visitas, cada pedido
  // relia tudo e a cota diária do Firestore acabava.
  it('leitura completa: pedidos dentro de um minuto dividem uma leitura só', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T00:00:00.000Z'));
    const reads = vi.fn(async () => fakeSnapshot([['p1', { name: 'A', updatedAt: { toMillis: () => 1000 } }]]));
    mocks.adminDb.mockReturnValue({ collection: () => ({ where: vi.fn(), get: reads }) });

    const first = response();
    const second = response();
    await Promise.all([
      catalog({ query: { action: 'products' } }, first),
      catalog({ query: { action: 'products' } }, second),
    ]);
    await catalog({ query: { action: 'products' } }, response());
    expect(reads).toHaveBeenCalledTimes(1);
    expect(second.body).toEqual(first.body);

    vi.setSystemTime(new Date('2026-11-08T00:01:01.000Z'));
    await catalog({ query: { action: 'products' } }, response());
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('o delta (`since`) sempre lê o banco', async () => {
    const reads = vi.fn(async () => fakeSnapshot([]));
    const collection = { where: () => collection, get: reads };
    mocks.adminDb.mockReturnValue({ collection: () => collection });

    await catalog({ query: { action: 'products' } }, response());
    await catalog({ query: { action: 'products', since: '500' } }, response());
    await catalog({ query: { action: 'products', since: '500' } }, response());

    expect(reads).toHaveBeenCalledTimes(3);
  });

  it('erro na leitura não fica guardado', async () => {
    const reads = vi.fn()
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValueOnce(fakeSnapshot([['p1', { name: 'A' }]]));
    mocks.adminDb.mockReturnValue({ collection: () => ({ where: vi.fn(), get: reads }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const failed = response();
    await catalog({ query: { action: 'products' } }, failed);
    const retried = response();
    await catalog({ query: { action: 'products' } }, retried);

    expect(failed.statusCode).toBe(500);
    expect(retried.statusCode).toBe(200);
    expect(retried.body.items).toEqual([{ id: 'p1', name: 'A' }]);
  });
});
