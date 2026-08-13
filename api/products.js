import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_lib/firebase-admin.js';
import { handleCors, HttpError, sendError } from './_lib/http.js';

// Only fields needed by the public catalog are returned. Costs, supplier data,
// moderation flags, and other ERP-only fields never cross this boundary.
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

export default async function handler(req, res) {
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
        if (data.__deleted === true) deleted.push(document.id);
        continue;
      }
      if (product.__deleted) deleted.push(document.id);
      else items.push(product);
    }
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json({ items, deleted, maxMs });
  } catch (error) {
    console.error('[products]', error instanceof Error ? error.message : error);
    return sendError(res, error);
  }
}
