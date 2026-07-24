import { adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  optionalText,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

function boundedCounter(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function parseEvent(body) {
  assertExactKeys(body, ['type', 'slug', 'label', 'productId', 'productName', 'countryCode', 'city']);
  const type = requiredText(body.type, { max: 20 });
  if (!['visit', 'page', 'product'].includes(type)) throw new HttpError(400, 'invalid_request');

  if (type === 'page') {
    const slug = requiredText(body.slug, { max: 160 });
    if (!slug.startsWith('/') || slug.includes('\\')) throw new HttpError(400, 'invalid_request');
    return { type, slug, label: requiredText(body.label, { max: 160 }) };
  }
  if (type === 'product') {
    return {
      type,
      productId: requiredText(body.productId, { max: 160, pattern: /^[^/]+$/ }),
      productName: requiredText(body.productName, { max: 240 }),
    };
  }

  const countryCode = optionalText(body.countryCode, { max: 2 }).toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) throw new HttpError(400, 'invalid_request');
  return { type, countryCode, city: optionalText(body.city, { max: 100 }) };
}

async function incrementEvent(event) {
  const db = adminDb();
  const now = new Date();
  const updatedAt = now.toISOString();

  if (event.type === 'page') {
    const id = event.slug.replace(/\//g, '_').replace(/^_/, '') || 'home';
    const ref = db.collection('analytics_pages').doc(id);
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      transaction.set(ref, {
        slug: event.slug,
        label: event.label,
        views: boundedCounter(snap.data()?.views) + 1,
        updatedAt,
      });
    });
    return;
  }

  if (event.type === 'product') {
    const ref = db.collection('analytics_products').doc(event.productId);
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      transaction.set(ref, {
        productId: event.productId,
        productName: event.productName,
        views: boundedCounter(snap.data()?.views) + 1,
        updatedAt,
      });
    });
    return;
  }

  const date = updatedAt.slice(0, 10);
  const ref = db.collection('analytics_daily').doc(date);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const previous = snap.data() || {};
    const countries = { ...(previous.countries || {}) };
    const cities = { ...(previous.cities || {}) };
    if (event.countryCode && (event.countryCode in countries || Object.keys(countries).length < 250)) {
      countries[event.countryCode] = boundedCounter(countries[event.countryCode]) + 1;
    }
    if (event.city && (event.city in cities || Object.keys(cities).length < 1000)) {
      cities[event.city] = boundedCounter(cities[event.city]) + 1;
    }
    transaction.set(ref, {
      date,
      total: boundedCounter(previous.total) + 1,
      countries,
      cities,
      updatedAt,
    });
  });
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;
  try {
    const event = parseEvent(parseJsonObject(req.body));
    await enforceRateLimit(req, {
      scope: `analytics:${event.type}`,
      limit: event.type === 'visit' ? 30 : 300,
      windowMs: 60 * 60 * 1000,
    });
    await incrementEvent(event);
    res.status(202).json({ ok: true });
  } catch (error) {
    console.error('[analytics]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
