import { requireAdmin, requireUser } from './_lib/auth.js';
import { adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  getHeader,
  handleCors,
  HttpError,
  normalizeEmail,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

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
    const user = await requireUser(req);

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
