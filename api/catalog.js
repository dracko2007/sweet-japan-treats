import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_lib/firebase-admin.js';
import { handleCors, HttpError, sendError } from './_lib/http.js';
import geo from './_handlers/geo.js';
import productEnrich from './_handlers/product-enrich.js';
import sitemap from './_handlers/sitemap.js';
import wiseRate from './_handlers/wise-rate.js';

const PUBLIC_FIELDS = [
  'sku', 'gtin', 'name', 'description', 'category', 'prices', 'variants',
  'image', 'thumbnail', 'gallery', 'video', 'videoCover', 'model3d', 'flavor',
  'deliveryRestrict', 'origin', 'discountPercent', 'i18n', 'weightGrams', 'weightVerified',
  'tags', 'featured', 'featuredAt', 'heroCarousel', 'heroCarouselAt',
  'isNew', 'salesCount', 'rating', 'stock', 'promoGift',
  // Produto que já está no país do cliente (preço fixo, unidades e frete de lá); sem isto a vitrine
  // servida por /api/products nunca sabe que o produto tem estoque local.
  'localStock',
];

function querySince(value) {
  if (value === undefined || value === '') return null;
  const millis = Number(value);
  if (!Number.isFinite(millis) || millis < 0) throw new HttpError(400, 'invalid_since');
  return Timestamp.fromMillis(millis);
}

function publicProduct(id, data) {
  if (data.__deleted === true) return { id, __deleted: true, updatedAt: data.updatedAt || null };
  if (data.hidden === true) return null;
  const result = { id };
  for (const field of PUBLIC_FIELDS) {
    if (data[field] !== undefined) result[field] = data[field];
  }
  return result;
}

async function readCatalog(since) {
  let query = adminDb().collection('products');
  if (since) query = query.where('updatedAt', '>=', since);
  const snapshot = await query.get();
  const items = [];
  const deleted = [];
  let maxMs = since?.toMillis() || 0;
  for (const document of snapshot.docs) {
    const data = document.data() || {};
    const stamp = data.updatedAt;
    if (stamp && typeof stamp.toMillis === 'function') maxMs = Math.max(maxMs, stamp.toMillis());
    const product = publicProduct(document.id, data);
    if (!product) {
      // Hidden (and actually-deleted) docs must be reported as tombstones too.
      // Without this, a product hidden after a client already cached it as
      // visible never gets purged: the delta query returns it (updatedAt
      // changed), publicProduct() correctly excludes it from `items`, but
      // the client's local cache keeps serving the stale visible copy
      // forever because it never saw a matching id in `deleted`.
      if (data.__deleted === true || data.hidden === true) deleted.push(document.id);
      continue;
    }
    if (product.__deleted) deleted.push(document.id);
    else items.push(product);
  }
  return { items, deleted, maxMs };
}

// A leitura completa (primeira visita, sem catálogo salvo no navegador) custa
// uma leitura do Firestore por produto. Numa onda de visitas — um post que
// viraliza — cada pedido relia tudo, e a cota diária acaba (foi o que derrubou
// a loja em 26/07/2026). Por isso a leitura completa fica um minuto em memória
// e pedidos simultâneos dividem a mesma leitura. Quem recebe essa cópia pede
// depois só o que mudou (`since=maxMs`) e pega o que entrou nesse minuto. O
// delta (`since`) e as edições do admin não passam por aqui.
const FULL_CATALOG_TTL_MS = 60_000;
let fullCatalog = null;

function cachedFullCatalog() {
  const now = Date.now();
  if (fullCatalog && now - fullCatalog.at < FULL_CATALOG_TTL_MS) return fullCatalog.promise;
  const entry = { at: now, promise: readCatalog(null) };
  // Erro não fica guardado: o próximo pedido tenta de novo.
  entry.promise.catch(() => {
    if (fullCatalog === entry) fullCatalog = null;
  });
  fullCatalog = entry;
  return entry.promise;
}

/** Só para testes. */
export function resetCatalogCache() {
  fullCatalog = null;
}

async function products(req, res) {
  if (!handleCors(req, res, { methods: ['GET'] })) return;
  try {
    const since = querySince(req.query?.since);
    const body = since ? await readCatalog(since) : await cachedFullCatalog();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json(body);
  } catch (error) {
    console.error('[products]', error instanceof Error ? error.message : error);
    return sendError(res, error);
  }
}

const HANDLERS = {
  geo,
  'product-enrich': productEnrich,
  products,
  sitemap,
  'wise-rate': wiseRate,
};

export default async function handler(req, res) {
  const value = req.query?.action;
  const action = String(Array.isArray(value) ? value[0] : value || '');
  const selected = HANDLERS[action];
  if (!selected) return res.status(400).json({ error: 'invalid_action' });
  return selected(req, res);
}
