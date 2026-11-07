/**
 * Geração de SKU (código de produto) da Japan Express.
 * Padrão: JE-<CAT>-<NNNN>  (ex.: JE-COS-0001, JE-DOC-0012)
 * - Único por categoria (números sequenciais dentro de cada categoria, nunca reaproveitados).
 * - Determinístico e estável em re-rodadas: produtos que já têm SKU válido são preservados.
 * - Módulo puro (sem dependências de alias "@/") para poder ser importado tanto pela
 *   app (via "@/utils/sku") quanto por scripts Node/Bun usando caminho relativo.
 */

export interface SkuItem {
  category: string;
  sku?: string;
}

/** Mapeia categorias conhecidas para códigos curtos e legíveis. */
const CATEGORY_CODES: Record<string, string> = {
  cosmeticos: 'COS',
  doces: 'DOC',
  acessorios: 'ACE',
  papelaria: 'PAP',
  eletronicos: 'ELE',
  masculino: 'MAS',
  vestuario: 'VES',
  higiene: 'HIG',
  docedeleite: 'DLT',
};

/** Código de categoria: usa a tabela fixa ou deriva das primeiras letras. */
export function categoryCode(category: string): string {
  const known = CATEGORY_CODES[category];
  if (known) return known;
  const cleaned = (category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return cleaned.slice(0, 3) || 'GEN';
}

/** Prefixo de SKU para uma categoria (ex.: "JE-COS"). */
export function skuPrefix(category: string): string {
  return `JE-${categoryCode(category)}`;
}

/** Verifica se o valor é um SKU válido no padrão Japan Express. */
export function isValidSku(sku: string | undefined | null): boolean {
  return !!sku && /^JE-[A-Z]{2,4}-\d{4}$/.test(sku);
}

/**
 * Maiores números já usados por prefixo, considerando TODOS os itens, de qualquer
 * categoria (um produto pode ter mudado de categoria depois de ganhar o SKU).
 */
function highestByPrefix(items: Array<{ sku?: string }>): Map<string, number> {
  const highest = new Map<string, number>();
  for (const item of items) {
    const m = item.sku?.trim().match(/^(JE-[A-Z]{2,4})-(\d{4})$/);
    if (m) highest.set(m[1], Math.max(highest.get(m[1]) ?? 0, Number(m[2])));
  }
  return highest;
}

/**
 * Gera o próximo SKU da categoria: o maior número já usado no prefixo + 1.
 * Nunca reaproveita número (nem de produto apagado), porque o SKU antigo pode
 * continuar em pedidos, planilhas e marketplaces. `existing` deve trazer TODOS os
 * produtos, inclusive os apagados (`productService.listAllSkus()`): foi gerar a
 * partir só dos produtos visíveis que criou os SKUs duplicados.
 */
export function generateUniqueSku(category: string, existing: SkuItem[] = []): string {
  const prefix = skuPrefix(category);
  const next = (highestByPrefix(existing).get(prefix) ?? 0) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

/** SKUs usados por mais de um produto (sku -> ids). */
export function findDuplicateSkus<T extends { id: string; sku?: string }>(items: T[]): Record<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const item of items) {
    const sku = item.sku?.trim();
    if (!sku) continue;
    byKey.set(sku, [...(byKey.get(sku) ?? []), item.id]);
  }
  return Object.fromEntries([...byKey].filter(([, ids]) => ids.length > 1));
}

/**
 * Atribui SKUs (id -> sku) APENAS aos itens que ainda não possuem um SKU válido,
 * continuando depois do maior número já usado em cada prefixo (sem reaproveitar).
 * Determinístico (ordena por id dentro de cada categoria). Usado pelo script de
 * backfill (Firestore); `items` deve incluir os produtos apagados.
 */
export function assignSkus<T extends SkuItem & { id: string }>(items: T[]): Record<string, string> {
  const assignments: Record<string, string> = {};
  const highest = highestByPrefix(items);
  const pending = items.filter((item) => !isValidSku(item.sku)).sort((a, b) => a.id.localeCompare(b.id));
  for (const item of pending) {
    const prefix = skuPrefix(item.category);
    const next = (highest.get(prefix) ?? 0) + 1;
    highest.set(prefix, next);
    assignments[item.id] = `${prefix}-${String(next).padStart(4, '0')}`;
  }
  return assignments;
}
