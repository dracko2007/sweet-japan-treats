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


function bootstrapAdminEmail() {
  return String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'dracko2007@gmail.com').trim().toLowerCase();
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  const adminRole = Number(user.adminRole);
  const hasAdminClaim =
    user.admin === true ||
    user.role === 'admin' ||
    user.adminRole === 'admin' ||
    [1, 2, 3].includes(adminRole);
  if (hasAdminClaim) {
    return user;
  }

  // Bootstrap: super-admin reconhecido pelo e-mail verificado no próprio token,
  // sem depender de custom claims pré-configuradas (mesma regra do firestore.rules).
  if (user.email_verified === true && String(user.email || '').toLowerCase() === bootstrapAdminEmail()) {
    return user;
  }

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
  if (authorization !== `Bearer ${secret}`) throw new HttpError(401, 'unauthorized');
}
