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

export default async function handler(req, res) {
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
