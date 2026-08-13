import { timingSafeEqual } from 'node:crypto';
import { adminAuth, adminDb } from './firebase-admin.js';
import { getHeader, HttpError } from './http.js';

function bearerToken(req) {
  const authorization = String(getHeader(req, 'authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) throw new HttpError(401, 'unauthorized');
  return match[1].trim();
}

export async function requireUser(req) {
  const token = bearerToken(req);
  try {
    return await adminAuth().verifyIdToken(token, true);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 503) throw error;
    throw new HttpError(401, 'unauthorized');
  }
}

/**
 * Require an identity with a verified, non-empty e-mail address. Firebase
 * anonymous users and accounts that have not completed e-mail verification
 * must not be used for e-mail-bound ownership or rewards.
 */
export async function requireVerifiedUser(req) {
  const user = await requireUser(req);
  if (user.email_verified !== true || typeof user.email !== 'string' || !user.email.trim()) {
    throw new HttpError(403, 'verified_email_required');
  }
  return user;
}


function configuredSuperAdminEmail() {
  return String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
}

/**
 * E-mail do super-admin de bootstrap, resolvido só a partir do ambiente. Havia
 * um endereço pessoal como padrão aqui: qualquer deploy sem ADMIN_EMAIL
 * entregava o painel inteiro para uma caixa que não é da loja. Sem configuração
 * explícita ninguém é super-admin, e quem depende do valor falha fechado.
 */
export function superAdminEmail() {
  const email = configuredSuperAdminEmail();
  if (!email) throw new HttpError(503, 'admin_not_configured');
  return email;
}

// Comprimento conferido antes do timingSafeEqual porque buffers de tamanhos
// diferentes fazem a função lançar em vez de devolver false — mesmo cuidado de
// api/_lib/ps-fee-waiver.js.
function sameSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdmin(req) {
  const user = await requireUser(req);

  // Claims and email are not sufficient: storage and Firestore rules use the
  // same active admins/{uid} record, so revocation is immediate everywhere.

  try {
    const byUid = await adminDb().collection('admins').doc(user.uid).get();
    if (byUid.exists && byUid.data()?.active === true) return user;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'authorization_unavailable');
  }
  throw new HttpError(403, 'forbidden');
}

export function requireCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, 'cron_not_configured');
  const authorization = String(getHeader(req, 'authorization') || '');
  if (!sameSecret(authorization, `Bearer ${secret}`)) throw new HttpError(401, 'unauthorized');
}
