// Serviço de produtos com persistência no Firestore + Firebase Storage para imagens.
// Os produtos de `data/products.ts` são a base (defaults).
// O admin pode criar/editar/remover; as mudanças ficam no Firestore (collection "products").
// Imagens ficam no Firebase Storage (CDN Google) — Firestore guarda só as URLs.
// Cache localStorage de 5 min evita re-fetch a cada navegação.

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
import { products as defaultProducts } from '@/data/products';
import { ensureAdminAuth } from '@/utils/adminAuth';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const COL = 'products';

// ─── Cache localStorage ────────────────────────────────────────────────────
const CACHE_KEY = 'jp_products_v3'; // v3: Firestore-only, sem merge com defaultProducts
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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

function setCache(products: Product[]): void {
  // Não cacheia se houver imagens em base64 — estoura o limite de 5MB do localStorage
  const hasBase64 = products.some(
    (p) => p.image?.startsWith('data:') || p.thumbnail?.startsWith('data:') || p.gallery?.some((g) => g?.startsWith('data:'))
  );
  if (hasBase64) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ products, ts: Date.now() } satisfies ProductCache));
  } catch { /* storage cheio — silencia */ }
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
        items.push({ id: d.id, ...(data as object) } as Product);
      });
      return { items, deleted };
    } catch (e) {
      devWarn('productService.getOverrides falhou:', e);
      throw e;
    }
  },

  /** Lista final: Firestore é fonte de verdade. defaultProducts entram só para IDs
   *  que o Firestore não tem (evita tela vazia em erros parciais).
   *  Usa cache de 5 min no localStorage para evitar re-fetch a cada navegação. */
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
