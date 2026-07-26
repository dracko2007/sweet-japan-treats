// Serviço de produtos com persistência no Firestore + Firebase Storage para imagens.
// Os produtos de `data/products.ts` são a base (defaults).
// O admin pode criar/editar/remover; as mudanças ficam no Firestore (collection "products").
// Imagens ficam no Cloudinary (CDN) — Firestore guarda só as URLs. Imagem
// embutida em base64 estoura o cache local e multiplica as leituras do banco.
// Cache localStorage de 60 min evita re-fetch a cada navegação.

import { db } from '@/config/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { Product } from '@/types';
import { cdnImage } from '@/services/cloudinaryService';
import { products as defaultProducts } from '@/data/products';
import { ensureAdminAuth } from '@/utils/adminAuth';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const COL = 'products';

// ─── Cache localStorage ────────────────────────────────────────────────────
const CACHE_KEY = 'jp_products_v4'; // v4: URLs normalizadas para entrega de alta qualidade
// 60 min: cada expiração custa uma releitura dos ~265 documentos do catálogo.
// Edições do admin não esperam o TTL — `save()`/`remove()` invalidam na hora.
const CACHE_TTL = 60 * 60 * 1000; // 60 minutos

interface ProductCache { products: Product[]; ts: number; }

function getCache(): Product[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { products, ts } = JSON.parse(raw) as ProductCache;
    if (Date.now() - ts > CACHE_TTL) return null;
    return products;
  } catch { return null; }
}

const CACHE_MAX_BYTES = 4_000_000;

/** IDs dos produtos cuja imagem ainda está embutida como `data:` URL. */
function embeddedImageIds(products: Product[]): string[] {
  const ids: string[] = [];
  for (const p of products) {
    const fontes = [p.image, p.thumbnail, ...(p.gallery ?? [])];
    if (fontes.some((src) => typeof src === 'string' && src.startsWith('data:'))) {
      ids.push(p.id);
    }
  }
  return ids;
}

let cacheSkip: { bytes: number; ids: string[] } | null = null;

/** Estado do cache do catálogo. Consumido pelo painel Admin → Imagens para
 *  mostrar por que o cache está desligado, em vez de deixar a loja degradar
 *  sem ninguém perceber. */
export function productCacheStatus(): { ok: boolean; bytes: number; ids: string[] } {
  if (!cacheSkip) return { ok: true, bytes: 0, ids: [] };
  return { ok: false, bytes: cacheSkip.bytes, ids: cacheSkip.ids };
}

function setCache(products: Product[]): void {
  try {
    const payload = JSON.stringify({ products, ts: Date.now() } satisfies ProductCache);
    // Desistir aqui em silêncio custa caro: sem cache, TODA navegação relê os
    // ~265 documentos do catálogo. A cota do plano Spark (50 mil leituras/dia)
    // acaba com ~37 visitantes e o Firestore passa a responder 429 — foi o que
    // derrubou a loja inteira em 26/07/2026, levando junto o envio de e-mails
    // (todo endpoint que toca o banco virou 503). O motivo agora fica visível.
    if (payload.length > CACHE_MAX_BYTES) {
      cacheSkip = { bytes: payload.length, ids: embeddedImageIds(products) };
      console.warn(
        `[catálogo] cache DESLIGADO: ${(payload.length / 1e6).toFixed(1)} MB excede o limite do localStorage. `
        + `${cacheSkip.ids.length} produto(s) com imagem embutida em base64. `
        + `Cada visita relerá ${products.length} documentos do Firestore e a cota diária vai acabar. `
        + 'Corrija em Admin → Imagens.',
      );
      return;
    }
    cacheSkip = null;
    localStorage.setItem(CACHE_KEY, payload);
  } catch {
    // localStorage cheio ou indisponível (Safari privado) — segue sem cache.
    cacheSkip = { bytes: 0, ids: [] };
  }
}

export function invalidateProductCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
// ──────────────────────────────────────────────────────────────────────────

const stripUndefined = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefined(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, item]) => {
      const cleanItem = stripUndefined(item);
      if (cleanItem !== undefined) acc[key] = cleanItem;
      return acc;
    }, {});
  }
  return value;
};

interface Overrides {
  items: Product[];
  deleted: string[];
}

/** Aplica o perfil de entrega de alta qualidade nas URLs de imagem.
 *  Roda no ingresso do Firestore para que todos os pontos de render recebam a
 *  URL certa sem repetir a transformação — inclusive os produtos legados, cuja
 *  URL gravada ainda carrega o `f_webp,q_auto` (≈75%) do pipeline antigo. */
const withCdnImages = (p: Product): Product => ({
  ...p,
  image: cdnImage(p.image),
  ...(p.thumbnail ? { thumbnail: cdnImage(p.thumbnail) } : {}),
  ...(p.gallery ? { gallery: p.gallery.map((g) => cdnImage(g)) } : {}),
});

export const productService = {
  /** Lê os documentos do Firestore (overrides do admin). */
  async getOverrides(): Promise<Overrides> {
    if (!db) throw new Error('Firebase indisponível');
    try {
      const snap = await getDocs(collection(db, COL));
      const items: Product[] = [];
      const deleted: string[] = [];
      snap.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        if (data.__deleted) {
          deleted.push(d.id);
          return;
        }
        items.push(withCdnImages({ id: d.id, ...(data as object) } as Product));
      });
      return { items, deleted };
    } catch (e) {
      devWarn('productService.getOverrides falhou:', e);
      throw e;
    }
  },

  /** Lista final: Firestore é fonte de verdade. defaultProducts entram só para IDs
   *  que o Firestore não tem (evita tela vazia em erros parciais).
   *  Usa cache de 60 min no localStorage para evitar re-fetch a cada navegação. */
  async getMerged(forceRefresh = false): Promise<Product[]> {
    if (!forceRefresh) {
      const cached = getCache();
      if (cached) return cached;
    }

    let items: Product[] = [];
    let deleted: string[] = [];
    try {
      ({ items, deleted } = await this.getOverrides());
    } catch {
      // Firestore inacessível (auth não pronta, offline, etc.) — usa defaults como fallback
      return defaultProducts;
    }

    // Firestore tem dados → ele é a fonte de verdade
    // IDs do Firestore sobrepõem defaults; defaults preenchem o que o Firestore não tem
    if (items.length > 0 || deleted.length > 0) {
      const map = new Map<string, Product>();
      // Começa com defaults SEM imagens próprias (só como esqueleto de fallback)
      for (const p of defaultProducts) {
        map.set(p.id, { ...p, image: '', gallery: [], thumbnail: undefined });
      }
      // Firestore sobrepõe (com imagens reais)
      for (const p of items) map.set(p.id, p);
      // Remove deletados
      for (const id of deleted) map.delete(id);
      const result = Array.from(map.values()).filter((p) => p.image); // só mostra quem tem imagem
      setCache(result);
      return result;
    }

    // Firestore vazio (loja nova): usa defaults
    setCache(defaultProducts);
    return defaultProducts;
  },

  /** Cria ou atualiza um produto. Invalida o cache local automaticamente. */
  async save(product: Product): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    const { id, ...rest } = product;
    const cleanRest = stripUndefined(rest) as Record<string, unknown>;
    Object.entries(rest).forEach(([key, value]) => {
      if (value === undefined) cleanRest[key] = deleteField();
    });
    await setDoc(
      doc(db, COL, id),
      { ...cleanRest, __deleted: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
    invalidateProductCache();
  },

  /** Decrementa o estoque ao confirmar uma venda. No-op se produto não existe ou é ilimitado. */
  async decrementStock(productId: string, qty: number): Promise<void> {
    if (!db || qty <= 0) return;
    try {
      await updateDoc(doc(db, COL, productId), {
        'stock.quantity': increment(-qty),
      });
    } catch {
      // Produto pode não existir no Firestore (default); ignora silenciosamente
    }
  },

  /** Esconde um produto (soft-delete) — funciona inclusive para os defaults. */
  async remove(id: string): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(
      doc(db, COL, id),
      { __deleted: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
    invalidateProductCache();
  },
};
