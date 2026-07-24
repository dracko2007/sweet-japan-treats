import { randomUUID } from 'node:crypto';
import { adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  normalizeEmail,
  optionalText,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

const SOURCES = new Set(['exit_intent', 'newsletter_footer', 'guide', 'cart_reminder']);
const SHIPPING = new Set(['aereo', 'maritimo', 'container', 'combinar']);

function optionalEmail(value) {
  return value ? normalizeEmail(value) : '';
}

function optionalUrl(value) {
  const text = optionalText(value, { max: 1000 });
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid');
    return url.toString();
  } catch {
    throw new HttpError(400, 'invalid_request');
  }
}

function customRequest(data) {
  assertExactKeys(data, ['name', 'contact', 'country', 'productDesc', 'referenceLink', 'quantity']);
  return {
    name: requiredText(data.name, { max: 120 }),
    contact: requiredText(data.contact, { max: 254 }),
    country: optionalText(data.country, { max: 80 }),
    productDesc: requiredText(data.productDesc, { max: 2000 }),
    referenceLink: optionalUrl(data.referenceLink),
    quantity: optionalText(data.quantity, { max: 100 }),
  };
}

function b2bRequest(data) {
  assertExactKeys(data, ['razaoSocial', 'cnpj', 'responsavel', 'contact', 'email', 'country', 'productDesc', 'estimatedQty', 'shipping', 'notes']);
  const shipping = requiredText(data.shipping, { max: 20 });
  if (!SHIPPING.has(shipping)) throw new HttpError(400, 'invalid_request');
  return {
    razaoSocial: requiredText(data.razaoSocial, { max: 180 }),
    cnpj: requiredText(data.cnpj, { max: 30 }),
    responsavel: requiredText(data.responsavel, { max: 120 }),
    contact: requiredText(data.contact, { max: 254 }),
    email: optionalEmail(data.email),
    country: optionalText(data.country, { max: 80 }),
    productDesc: requiredText(data.productDesc, { max: 3000 }),
    estimatedQty: requiredText(data.estimatedQty, { max: 120 }),
    shipping,
    notes: optionalText(data.notes, { max: 2000 }),
  };
}

function affiliateRequest(data) {
  assertExactKeys(data, ['name', 'email', 'message']);
  return {
    name: requiredText(data.name, { max: 120 }),
    email: normalizeEmail(data.email),
    message: optionalText(data.message, { max: 2000 }),
  };
}

function newsletter(data) {
  assertExactKeys(data, ['email', 'source']);
  const source = requiredText(data.source, { max: 40 });
  if (!SOURCES.has(source)) throw new HttpError(400, 'invalid_request');
  return { email: normalizeEmail(data.email), source };
}

function parseSubmission(body) {
  assertExactKeys(body, ['type', 'data']);
  const type = requiredText(body.type, { max: 40 });
  const data = parseJsonObject(body.data);
  if (type === 'custom_request') return { type, data: customRequest(data) };
  if (type === 'b2b_request') return { type, data: b2bRequest(data) };
  if (type === 'affiliate_request') return { type, data: affiliateRequest(data) };
  if (type === 'newsletter') return { type, data: newsletter(data) };
  throw new HttpError(400, 'invalid_request');
}

async function persistSubmission(type, data) {
  const db = adminDb();
  const now = new Date().toISOString();
  if (type === 'newsletter') {
    const id = data.email.replace(/[.#$/[\]]/g, '_');
    const ref = db.collection('newsletter').doc(id);
    const existing = await ref.get();
    await ref.set({
      email: data.email,
      source: data.source,
      lastSource: data.source,
      ...(existing.exists ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });
    return;
  }

  if (type === 'affiliate_request') {
    const ref = db.collection('affiliate_requests').doc(data.email);
    const existing = await ref.get();
    if (existing.exists) throw new HttpError(409, 'already_requested');
    await ref.create({ ...data, status: 'pending', requestedAt: now });
    return;
  }

  const isCustom = type === 'custom_request';
  const id = `${isCustom ? 'req' : 'b2b'}-${randomUUID()}`;
  await db.collection(isCustom ? 'custom_requests' : 'b2b_requests').doc(id).create({
    ...data,
    id,
    status: 'new',
    createdAt: now,
  });
}

async function handleSubmission(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;
  try {
    const submission = parseSubmission(parseJsonObject(req.body));
    await enforceRateLimit(req, {
      scope: `public-submission:${submission.type}`,
      limit: submission.type === 'newsletter' ? 10 : 5,
      windowMs: 60 * 60 * 1000,
    });
    await persistSubmission(submission.type, submission.data);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('[public-submission]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}

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

async function handleAnalytics(req, res) {
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

export default async function handler(req, res) {
  const { action } = req.query;
  if (action === 'submission') return handleSubmission(req, res);
  if (action === 'analytics') return handleAnalytics(req, res);
  return res.status(400).json({ error: 'invalid_action' });
}
