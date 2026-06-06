// Serviço de produtos com persistência no Firestore.
// Os 8 produtos de `data/products.ts` são a base (defaults).
// O admin pode criar/editar/remover; as mudanças ficam no Firestore (collection "products")
// e são mescladas por cima dos defaults. Fotos são guardadas como data URL (base64) dentro
// do documento, pois o Firebase Storage não está provisionado neste projeto.

import { db } from '@/config/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Product } from '@/types';
import { products as defaultProducts } from '@/data/products';
import { ensureAdminAuth } from '@/utils/adminAuth';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const COL = 'products';

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

  /** Lista final: defaults + criados no admin, com edições aplicadas e removidos escondidos. */
  async getMerged(): Promise<Product[]> {
    const { items, deleted } = await this.getOverrides();
    const hasFirestoreCatalog = items.length > 0 || deleted.length > 0;
    if (!hasFirestoreCatalog) return defaultProducts;

    const map = new Map<string, Product>();
    for (const p of defaultProducts) map.set(p.id, p);
    for (const p of items) map.set(p.id, p);
    for (const id of deleted) map.delete(id);
    return Array.from(map.values());
  },

  /** Cria ou atualiza um produto. */
  async save(product: Product): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    const { id, ...rest } = product;
    await setDoc(
      doc(db, COL, id),
      { ...rest, __deleted: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },

  /** Esconde um produto (soft-delete) — funciona inclusive para os 8 defaults. */
  async remove(id: string): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(
      doc(db, COL, id),
      { __deleted: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },
};
