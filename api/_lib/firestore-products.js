// Leitura server-side do catálogo. O Admin SDK reads private product
// documents, then this module projects only public fields.
import { adminDb } from './firebase-admin.js';

const PUBLIC_FIELDS = [
  'sku', 'gtin', 'name', 'description', 'category', 'prices', 'variants',
  'image', 'thumbnail', 'gallery', 'video', 'videoCover', 'flavor',
  'deliveryRestrict', 'origin', 'discountPercent', 'i18n', 'weightGrams',
  'tags', 'featured', 'featuredAt', 'heroCarousel', 'heroCarouselAt',
  'isNew', 'salesCount', 'rating', 'stock', 'promoGift',
];

export function parseValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  return undefined;
}

export function parseFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
  return out;
}

export function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export async function fetchProducts() {
  const snapshot = await adminDb().collection('products').get();
  return snapshot.docs.flatMap((document) => {
    const data = document.data() || {};
    if (data.hidden === true || data.__deleted === true) return [];
    const product = { id: document.id };
    for (const field of PUBLIC_FIELDS) {
      if (data[field] !== undefined) product[field] = data[field];
    }
    return [product];
  });
}

// Catálogo internacional: some produtos só podem ser entregues dentro do Japão
// e não devem aparecer em sitemap/feeds voltados a clientes de fora.
//
// `__deleted` é obrigatório aqui. O painel apaga produto por soft delete: o
// documento fica no Firestore como lápide para que os navegadores com cache
// aprendam a remoção pelo delta (`src/services/productService.ts:remove`). Como
// este módulo lê a coleção crua, 29 produtos já apagados continuavam sendo
// anunciados no Google — e cada clique caía em "produto não encontrado", que é
// dinheiro de anúncio queimado e motivo de reprovação no Merchant Center.
export function isVisibleInternationally(p) {
  return !p.hidden && !p.__deleted && p.deliveryRestrict !== 'japan-only';
}
