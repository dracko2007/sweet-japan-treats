import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_lib/firebase-admin.js';
import { handleCors, HttpError, sendError } from './_lib/http.js';
import geo from './_handlers/geo.js';
import productEnrich from './_handlers/product-enrich.js';
import sitemap from './_handlers/sitemap.js';
import wiseRate from './_handlers/wise-rate.js';

const PUBLIC_FIELDS = [
  'sku', 'gtin', 'name', 'description', 'category', 'prices', 'variants',
  'image', 'thumbnail', 'gallery', 'video', 'videoCover', 'flavor',
  'deliveryRestrict', 'origin', 'discountPercent', 'i18n', 'weightGrams',
  'tags', 'featured', 'featuredAt', 'heroCarousel', 'heroCarouselAt',
  'isNew', 'salesCount', 'rating', 'stock', 'promoGift',
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

async function products(req, res) {
  if (!handleCors(req, res, { methods: ['GET'] })) return;
  try {
    const since = querySince(req.query?.since);
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({ items, deleted, maxMs });
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
