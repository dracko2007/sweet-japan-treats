// O cache do catálogo desligar em silêncio derrubou a loja inteira em
// 26/07/2026: sem cache, cada visita relia os ~265 documentos do Firestore, a
// cota diária do plano gratuito acabava e TODO endpoint que toca o banco
// passava a responder 503 — inclusive o envio de e-mails de confirmação.
// Estes testes defendem o contrato que torna essa falha visível.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({ getDocs: vi.fn() }));

vi.mock('@/config/firebase', () => ({ auth: {}, db: {}, firebaseConfigReady: true }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ kind: 'collection' })),
  getDocs: firestoreMocks.getDocs,
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  serverTimestamp: vi.fn(),
  deleteField: vi.fn(),
}));

vi.mock('@/data/products', () => ({ products: [] }));
vi.mock('@/utils/adminAuth', () => ({ ensureAdminAuth: vi.fn() }));
vi.mock('@/services/cloudinaryService', () => ({ cdnImage: (url: string) => url }));

import { productCacheStatus, productService, invalidateProductCache } from '@/services/productService';

interface FakeDoc {
  id: string;
  data: () => Record<string, unknown>;
}

function produto(id: string, image: string): FakeDoc {
  return { id, data: () => ({ name: id, image, price: 100 }) };
}

function responder(docs: FakeDoc[]): void {
  firestoreMocks.getDocs.mockResolvedValue({
    forEach: (fn: (d: FakeDoc) => void) => docs.forEach(fn),
  });
}

describe('cache do catálogo', () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateProductCache();
    firestoreMocks.getDocs.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('guarda o catálogo quando ele cabe no localStorage', async () => {
    responder([produto('a', 'https://cdn/a.webp'), produto('b', 'https://cdn/b.webp')]);

    await productService.getMerged(true);

    expect(productCacheStatus().ok).toBe(true);
    expect(localStorage.getItem('jp_products_v4')).not.toBeNull();
  });

  it('serve do cache sem reler o Firestore na navegação seguinte', async () => {
    responder([produto('a', 'https://cdn/a.webp')]);
    await productService.getMerged(true);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);

    await productService.getMerged();

    // A segunda navegação NÃO pode custar outra leitura de 265 documentos.
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
  });

  it('denuncia os produtos base64 quando o catálogo não cabe', async () => {
    const gigante = 'data:image/webp;base64,' + 'A'.repeat(4_200_000);
    responder([produto('leve', 'https://cdn/ok.webp'), produto('pesado', gigante)]);

    await productService.getMerged(true);

    const status = productCacheStatus();
    expect(status.ok).toBe(false);
    expect(status.ids).toEqual(['pesado']);
    expect(status.bytes).toBeGreaterThan(4_000_000);
    // O silêncio é o bug: a falha precisa chegar a alguém.
    expect(console.warn).toHaveBeenCalled();
  });

  it('não deixa cache velho no ar quando o catálogo passa a não caber', async () => {
    responder([produto('a', 'https://cdn/a.webp')]);
    await productService.getMerged(true);
    expect(localStorage.getItem('jp_products_v4')).not.toBeNull();

    const gigante = 'data:image/webp;base64,' + 'A'.repeat(4_200_000);
    responder([produto('a', gigante)]);
    await productService.getMerged(true);

    expect(productCacheStatus().ok).toBe(false);
  });
});
