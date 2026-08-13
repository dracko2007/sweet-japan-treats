import { createHash } from 'node:crypto';
import { adminDb } from './firebase-admin.js';
import { getHeader, HttpError } from './http.js';

function clientAddress(req) {
  const trustedHeader = String(process.env.TRUSTED_PROXY_IP_HEADER || '').trim().toLowerCase();
  const trustedProxy = process.env.TRUSTED_PROXY === 'true';
  const headerValue = trustedHeader && trustedProxy ? getHeader(req, trustedHeader) : '';
  if (headerValue) return String(headerValue).split(',')[0].trim();
  return String(req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
}

function documentId(scope, identity) {
  return createHash('sha256').update(`${scope}:${identity}`).digest('hex');
}

export async function enforceRateLimit(req, {
  scope,
  limit,
  windowMs,
  identity,
}) {
  if (!scope || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1000) {
    throw new HttpError(500, 'invalid_rate_limit_configuration');
  }
  const key = identity || clientAddress(req);
  const ref = adminDb().collection('_rate_limits').doc(documentId(scope, key));
  const now = Date.now();

  try {
    await adminDb().runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const data = snap.exists ? snap.data() : null;
      const startedAt = Number(data?.startedAt || 0);
      const count = Number(data?.count || 0);
      if (!startedAt || now - startedAt >= windowMs) {
        transaction.set(ref, {
          scope,
          startedAt: now,
          count: 1,
          expiresAt: new Date(now + windowMs * 2),
        });
        return;
      }
      if (count >= limit) throw new HttpError(429, 'rate_limited');
      transaction.update(ref, { count: count + 1 });
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'rate_limit_unavailable');
  }
}
