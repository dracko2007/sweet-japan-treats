import { requireAdmin, requireUser } from './_lib/auth.js';
import { adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  getHeader,
  optionalText,
  handleCors,
  HttpError,
  normalizeEmail,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';
import { createHash } from 'node:crypto';
import { oembedEndpoint, parseReviewUrl } from './_lib/review-links.js';

// Validar um código diz se ele existe. Sem limite dava para testar códigos em série.
const VALIDATE_PER_USER = 30;
const VALIDATE_PER_GUEST_IP = 60; // folgado: sem TRUSTED_PROXY, vários visitantes podem dividir o IP do proxy
const VALIDATE_WINDOW_MS = 10 * 60 * 1000;

function adminRequested(body) {
  if (body.admin === undefined) return false;
  if (body.admin !== true) throw new HttpError(400, 'invalid_request');
  return true;
}

function tokenEmail(user) {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) throw new HttpError(403, 'forbidden');
  return email;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// 'promoter' = divulgador: recebe o produto grátis, não tem comissão nem meta;
// só medimos o retorno (visitas e compras) de cada código/link.
export function affiliateKind(data) {
  return data?.kind === 'promoter' ? 'promoter' : 'affiliate';
}

function affiliateSummary(document) {
  const data = document.data() || {};
  return {
    code: document.id,
    discountPercent: numberOrZero(data.discountPercent),
    commissionPercent: numberOrZero(data.commissionPercent),
    active: data.active === true,
    expiresAt: String(data.expiresAt || ''),
    totalOrders: numberOrZero(data.totalOrders),
    totalRevenue: numberOrZero(data.totalRevenue),
    totalEarnings: numberOrZero(data.totalEarnings),
    tier: ['bronze', 'silver', 'gold'].includes(data.tier) ? data.tier : 'bronze',
    currentMonthRevenue: numberOrZero(data.currentMonthRevenue),
    tierSettings: data.tierSettings || null,
    kind: affiliateKind(data),
    productId: String(data.productId || ''),
    productName: String(data.productName || ''),
    visitCount: numberOrZero(data.visitCount),
    linkVisits: numberOrZero(data.linkVisits),
    codeVisits: numberOrZero(data.codeVisits),
  };
}

function pendingSummary(document) {
  const data = document.data() || {};
  return {
    id: document.id,
    affiliateCode: String(data.affiliateCode || ''),
    netYen: numberOrZero(data.netYen),
    commissionYen: numberOrZero(data.commissionYen),
  };
}

async function listByOwner(req, user, body) {
  assertExactKeys(body, ['action', 'ownerEmail', 'admin']);
  const ownerEmail = normalizeEmail(body.ownerEmail);
  const asAdmin = adminRequested(body);
  if (asAdmin) {
    await requireAdmin(req);
  } else if (ownerEmail !== tokenEmail(user)) {
    throw new HttpError(403, 'forbidden');
  }

  const snapshot = await adminDb()
    .collection('affiliates')
    .where('ownerEmail', '==', ownerEmail)
    .get();
  return snapshot.docs.map(affiliateSummary);
}

async function listPending(req, user, body) {
  assertExactKeys(body, ['action', 'code', 'admin']);
  const code = requiredText(body.code, { max: 80 }).toUpperCase();
  const asAdmin = adminRequested(body);
  if (asAdmin) await requireAdmin(req);
  const email = asAdmin ? '' : tokenEmail(user);

  const snapshot = await adminDb()
    .collection('affiliate_pending')
    .where('affiliateCode', '==', code)
    .get();

  return snapshot.docs
    .filter((document) => {
      const data = document.data() || {};
      if (data.status !== 'pending') return false;
      if (asAdmin) return true;
      return String(data.ownerEmail || '').trim().toLowerCase() === email
        || String(data.buyerEmail || '').trim().toLowerCase() === email;
    })
    .map(pendingSummary);
}

async function optionalUser(req) {
  return String(getHeader(req, 'authorization') || '') ? requireUser(req) : null;
}

// Carrinho (inclusive visitante): confere o código e devolve só o que a tela usa.
// E-mail, ganhos e vendas do afiliado nunca saem daqui (antes o navegador lia o doc inteiro).
async function validateCode(req, body) {
  assertExactKeys(body, ['action', 'code']);
  // Códigos são criados livremente no admin: aceita qualquer id válido do Firestore (sem '/', '.' ou '..').
  const code = requiredText(body.code, { max: 80, pattern: /^(?!\.\.?$)[^/]+$/ }).toUpperCase();
  const user = await optionalUser(req);
  await enforceRateLimit(req, user
    ? { scope: 'affiliate-validate', limit: VALIDATE_PER_USER, windowMs: VALIDATE_WINDOW_MS, identity: user.uid }
    : { scope: 'affiliate-validate:guest', limit: VALIDATE_PER_GUEST_IP, windowMs: VALIDATE_WINDOW_MS });

  const snapshot = await adminDb().collection('affiliates').doc(code).get();
  if (!snapshot.exists) return { valid: false, reason: 'not_found' };
  const data = snapshot.data() || {};
  if (data.active !== true) return { valid: false, reason: 'inactive' };
  const expiresAt = String(data.expiresAt || '');
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return { valid: false, reason: 'expired' };
  return {
    valid: true,
    affiliate: {
      code: snapshot.id,
      ownerName: String(data.ownerName || '').slice(0, 120),
      discountPercent: Math.max(0, Math.min(100, numberOrZero(data.discountPercent))),
      expiresAt,
      kind: affiliateKind(data),
    },
  };
}

// Conta quem chegou por um código: abriu o link (?ref=) ou digitou o código no carrinho.
// Cada pessoa conta uma vez por código (conta logada = uid; visitante = id do navegador).
async function trackVisit(req, body) {
  assertExactKeys(body, ['action', 'code', 'source', 'visitorId']);
  const code = requiredText(body.code, { max: 80, pattern: /^(?!\.\.?$)[^/]+$/ }).toUpperCase();
  const source = body.source === 'code' ? 'code' : 'link';
  const visitorId = requiredText(body.visitorId, { max: 64, pattern: /^[A-Za-z0-9_-]{8,64}$/ });
  const user = await optionalUser(req);
  await enforceRateLimit(req, user
    ? { scope: 'affiliate-visit', limit: VALIDATE_PER_USER, windowMs: VALIDATE_WINDOW_MS, identity: user.uid }
    : { scope: 'affiliate-visit:guest', limit: VALIDATE_PER_GUEST_IP, windowMs: VALIDATE_WINDOW_MS });

  const db = adminDb();
  const affiliateRef = db.collection('affiliates').doc(code);
  const visitRef = db.collection('affiliate_visits').doc(`${code}__${user ? `u_${user.uid}` : `v_${visitorId}`}`);
  return db.runTransaction(async (transaction) => {
    const [affiliateSnap, visitSnap] = await Promise.all([transaction.get(affiliateRef), transaction.get(visitRef)]);
    if (!affiliateSnap.exists || visitSnap.exists) return { counted: false };
    const data = affiliateSnap.data() || {};
    if (data.active !== true) return { counted: false };
    // O próprio dono conferindo o link não é retorno.
    const email = String(user?.email || '').trim().toLowerCase();
    if (email && email === String(data.ownerEmail || '').trim().toLowerCase()) return { counted: false };
    transaction.set(visitRef, { code, source, createdAt: new Date().toISOString() });
    const sourceField = source === 'code' ? 'codeVisits' : 'linkVisits';
    transaction.update(affiliateRef, {
      visitCount: numberOrZero(data.visitCount) + 1,
      [sourceField]: numberOrZero(data[sourceField]) + 1,
    });
    return { counted: true };
  });
}

/* ---------- Reviews (vídeos) dos divulgadores ---------- */

// 'unavailable': aprovado, mas o vídeo saiu do ar na rede (apagado ou privado) — some do site sozinho.
const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'unavailable'];
const REVIEWS_PER_USER = 10;
const REVIEWS_WINDOW_MS = 60 * 60 * 1000;

function reviewSummary(document, { admin = false } = {}) {
  const data = document.data() || {};
  return {
    id: document.id,
    code: String(data.code || ''),
    productId: String(data.productId || ''),
    productName: String(data.productName || ''),
    ownerName: String(data.ownerName || ''),
    platform: String(data.platform || ''),
    videoId: String(data.videoId || ''),
    url: String(data.url || ''),
    title: String(data.title || ''),
    thumbnail: String(data.thumbnail || ''),
    status: REVIEW_STATUSES.includes(data.status) ? data.status : 'pending',
    createdAt: String(data.createdAt || ''),
    ...(admin ? { ownerEmail: String(data.ownerEmail || '') } : {}),
  };
}

const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

// Título e miniatura vêm do oEmbed público (YouTube/TikTok). É enfeite: se falhar, o review entra do mesmo jeito.
async function reviewMetadata(review) {
  const endpoint = oembedEndpoint(review);
  if (!endpoint) return {};
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
    if (!response.ok) return {};
    const data = await response.json();
    const thumbnail = String(data.thumbnail_url || '');
    return {
      title: String(data.title || '').slice(0, 160),
      thumbnail: /^https:\/\//.test(thumbnail) ? thumbnail.slice(0, 600) : '',
    };
  } catch {
    return {};
  }
}

// O divulgador cola o link do vídeo no painel, ligado a um código dele. Entra como pendente.
async function submitReview(req, user, body) {
  assertExactKeys(body, ['action', 'code', 'url', 'title']);
  const code = requiredText(body.code, { max: 80, pattern: /^(?!\.\.?$)[^/]+$/ }).toUpperCase();
  const review = parseReviewUrl(requiredText(body.url, { max: 500 }));
  if (!review) throw new HttpError(400, 'invalid_review_url');
  const typedTitle = optionalText(body.title, { max: 160 });
  const email = tokenEmail(user);
  await enforceRateLimit(req, { scope: 'affiliate-review', limit: REVIEWS_PER_USER, windowMs: REVIEWS_WINDOW_MS, identity: user.uid });

  const db = adminDb();
  const affiliateSnap = await db.collection('affiliates').doc(code).get();
  const affiliate = affiliateSnap.exists ? affiliateSnap.data() || {} : null;
  if (!affiliate || String(affiliate.ownerEmail || '').trim().toLowerCase() !== email) throw new HttpError(403, 'forbidden');

  const id = createHash('sha256').update(`${code}|${review.url}`).digest('hex').slice(0, 32);
  const ref = db.collection('affiliate_reviews').doc(id);
  if ((await ref.get()).exists) throw new HttpError(409, 'review_already_sent');

  const metadata = await reviewMetadata(review);
  await ref.set({
    code,
    ownerEmail: email,
    ownerName: String(affiliate.ownerName || '').slice(0, 120),
    productId: String(affiliate.productId || ''),
    productName: String(affiliate.productName || ''),
    platform: review.platform,
    videoId: review.videoId,
    url: review.url,
    title: typedTitle || metadata.title || '',
    thumbnail: metadata.thumbnail || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  await notifyAdminOfReview({ code, ownerName: String(affiliate.ownerName || email), productName: String(affiliate.productName || ''), url: review.url });
  return reviewSummary(await ref.get());
}

// Avisa a loja por e-mail que chegou vídeo para aprovar. É cortesia: nunca derruba o envio.
async function notifyAdminOfReview({ code, ownerName, productName, url }) {
  try {
    const [{ superAdminEmail }, { sendMail, wrapEmail, siteOrigin }, { escapeHtml }] = await Promise.all([
      import('./_lib/auth.js'), import('./_lib/mailer.js'), import('./_lib/http.js'),
    ]);
    await sendMail({
      to: superAdminEmail(),
      subject: `Novo vídeo de review para aprovar — ${code}`,
      html: wrapEmail(`
        <h2>Novo vídeo de review</h2>
        <p><strong>${escapeHtml(ownerName)}</strong> enviou um vídeo pelo código <strong>${escapeHtml(code)}</strong>${productName ? ` (${escapeHtml(productName)})` : ''}.</p>
        <p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
        <p>Para publicar no site, aprove em <a href="${siteOrigin()}/admin?aba=affiliates">Admin → Afiliados</a>.</p>`),
    });
  } catch (error) {
    console.error('review_notification_failed', error?.message || error);
  }
}

async function myReviews(user, body) {
  assertExactKeys(body, ['action']);
  const snapshot = await adminDb().collection('affiliate_reviews').where('ownerEmail', '==', tokenEmail(user)).get();
  return snapshot.docs.map((document) => reviewSummary(document)).sort(newestFirst);
}

// Vlog público: só os aprovados, sem e-mail de ninguém.
async function publicReviews(body) {
  assertExactKeys(body, ['action', 'productId']);
  // Página de produto pede só os reviews daquele produto.
  const productId = optionalText(body.productId, { max: 120 });
  const snapshot = await adminDb().collection('affiliate_reviews').where('status', '==', 'approved').get();
  return snapshot.docs
    .map((document) => reviewSummary(document))
    .filter((review) => !productId || review.productId === productId)
    .sort(newestFirst)
    .slice(0, 60);
}

// O divulgador pode apagar o vídeo ou deixá-lo privado. Confere no oEmbed (YouTube/TikTok)
// e tira do site o que saiu do ar; se voltar, volta a aparecer. Instagram não tem como conferir.
async function checkReviews(req, body) {
  assertExactKeys(body, ['action']);
  await requireAdmin(req);
  const collection = adminDb().collection('affiliate_reviews');
  const snapshot = await collection.get();
  const candidates = snapshot.docs
    .map((document) => ({ id: document.id, ...reviewSummary(document) }))
    .filter((review) => ['approved', 'unavailable'].includes(review.status) && oembedEndpoint(review))
    .slice(0, 40);
  let hidden = 0;
  let restored = 0;
  await Promise.all(candidates.map(async (review) => {
    let gone;
    try {
      const response = await fetch(oembedEndpoint(review), { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
      if (response.ok) gone = false;
      else if ([400, 401, 403, 404].includes(response.status)) gone = true;
    } catch {
      // Sem resposta não prova nada: mantém como está.
    }
    if (gone === undefined || gone === (review.status === 'unavailable')) return;
    await collection.doc(review.id).update({ status: gone ? 'unavailable' : 'approved', checkedAt: new Date().toISOString() });
    if (gone) hidden += 1; else restored += 1;
  }));
  return { checked: candidates.length, hidden, restored };
}

/* ---------- Compras por código de divulgador ---------- */

// Conta direto nos pedidos (pagos e não cancelados), e não num contador:
// pedido cancelado ou excluído depois sai da conta sozinho.
function countsAsPurchase(order) {
  return order.paymentConfirmed === true && !['cancelled', 'cancelado'].includes(String(order.status || ''));
}

async function promoterOrders(req, user, body) {
  assertExactKeys(body, ['action', 'admin']);
  const asAdmin = adminRequested(body);
  if (asAdmin) await requireAdmin(req);
  const db = adminDb();
  const affiliatesQuery = asAdmin
    ? db.collection('affiliates').where('kind', '==', 'promoter')
    : db.collection('affiliates').where('ownerEmail', '==', tokenEmail(user));
  const codes = (await affiliatesQuery.get()).docs
    .filter((document) => affiliateKind(document.data()) === 'promoter')
    .map((document) => document.id)
    .slice(0, 200);

  const byCode = {};
  await Promise.all(codes.map(async (code) => {
    const snapshot = await db.collection('orders').where('affiliateCode', '==', code).get();
    const orders = snapshot.docs
      .map((document) => document.data() || {})
      .filter(countsAsPurchase)
      .map((order) => ({
        date: String(order.paymentConfirmedAt || order.orderDate || ''),
        netYen: numberOrZero(order.netProductsYen),
        // Quem comprou só interessa à loja; o divulgador vê data e valor.
        ...(asAdmin ? { orderId: String(order.id || order.orderNumber || ''), customerName: String(order.customerName || '') } : {}),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    byCode[code] = {
      count: orders.length,
      revenueYen: orders.reduce((sum, order) => sum + order.netYen, 0),
      orders: orders.slice(0, 50),
    };
  }));
  return byCode;
}

async function adminReviews(req, body) {
  assertExactKeys(body, ['action']);
  await requireAdmin(req);
  const snapshot = await adminDb().collection('affiliate_reviews').get();
  return snapshot.docs.map((document) => reviewSummary(document, { admin: true })).sort(newestFirst);
}

async function moderateReview(req, body) {
  assertExactKeys(body, ['action', 'id', 'status']);
  await requireAdmin(req);
  const id = requiredText(body.id, { max: 64, pattern: /^[a-f0-9]{32}$/ });
  const status = requiredText(body.status, { max: 10 });
  const ref = adminDb().collection('affiliate_reviews').doc(id);
  if (status === 'deleted') {
    await ref.delete();
    return { ok: true };
  }
  if (!REVIEW_STATUSES.includes(status)) throw new HttpError(400, 'invalid_request');
  if (!(await ref.get()).exists) throw new HttpError(404, 'not_found');
  await ref.update({ status, moderatedAt: new Date().toISOString() });
  return { ok: true };
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const body = parseJsonObject(req.body);
    const action = requiredText(body.action, { max: 20 });
    if (action === 'validate') {
      res.status(200).json(await validateCode(req, body));
      return;
    }
    if (action === 'track-visit') {
      res.status(200).json(await trackVisit(req, body));
      return;
    }
    if (action === 'review-list') {
      res.status(200).json({ reviews: await publicReviews(body) });
      return;
    }
    const user = await requireUser(req);

    if (action === 'review-submit') {
      res.status(200).json({ review: await submitReview(req, user, body) });
      return;
    }
    if (action === 'review-mine') {
      res.status(200).json({ reviews: await myReviews(user, body) });
      return;
    }
    if (action === 'review-admin-list') {
      res.status(200).json({ reviews: await adminReviews(req, body) });
      return;
    }
    if (action === 'review-check') {
      res.status(200).json(await checkReviews(req, body));
      return;
    }
    if (action === 'promoter-orders') {
      res.status(200).json({ orders: await promoterOrders(req, user, body) });
      return;
    }
    if (action === 'review-moderate') {
      res.status(200).json(await moderateReview(req, body));
      return;
    }

    if (action === 'by-owner') {
      res.status(200).json({ affiliates: await listByOwner(req, user, body) });
      return;
    }
    if (action === 'pending-by-code') {
      res.status(200).json({ pending: await listPending(req, user, body) });
      return;
    }
    throw new HttpError(400, 'invalid_request');
  } catch (error) {
    sendError(res, error);
  }
}
