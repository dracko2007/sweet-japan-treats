// Custo de aquisição dos produtos, fora do documento público do produto.
//
// `products/{id}` tem leitura pública (a vitrine e a avaliação de produto
// dependem disso), então qualquer campo gravado ali pode ser lido por um
// visitante. O custo fica em `productCosts/{id}`, que só o admin lê e escreve.

import { db } from '@/config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Product } from '@/types';

export const PRODUCT_COSTS_COL = 'productCosts';

/** Normaliza o custo: número finito e não negativo, em ¥ inteiros. */
export function normalizeCost(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Lê todos os custos. Só funciona logado como admin (regras do Firestore). */
export async function loadProductCosts(): Promise<Map<string, number>> {
  const costs = new Map<string, number>();
  if (!db) return costs;
  const snap = await getDocs(collection(db, PRODUCT_COSTS_COL));
  snap.forEach((d) => costs.set(d.id, normalizeCost(d.data().cost)));
  return costs;
}

/** Junta os custos aos produtos. Produto sem custo cadastrado fica como está. */
export function withCosts(products: Product[], costs: Map<string, number> | null): Product[] {
  if (!costs || costs.size === 0) return products;
  return products.map((p) => (costs.has(p.id) ? { ...p, cost: costs.get(p.id) } : p));
}

/** Lista do painel admin: os publicados e, depois, os ocultos que ainda não
 *  estão na lista, todos com o custo junto. */
export function mergeAdminProducts(
  visible: Product[],
  hidden: Product[],
  costs: Map<string, number> | null,
): Product[] {
  if (hidden.length === 0) return visible;
  const ids = new Set(visible.map((p) => p.id));
  return [...visible, ...withCosts(hidden.filter((p) => !ids.has(p.id)), costs)];
}
