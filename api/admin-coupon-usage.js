import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from './_lib/auth.js';
import { adminDb } from './_lib/firebase-admin.js';
import { handleCors, HttpError, sendError } from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';
import { couponRow, matchesCouponFilters, orderEpoch } from './_lib/order-analytics.js';

const DATE_FIELDS = ['orderDate', 'date', 'syncedAt'];
const MAX_SCAN_PER_SOURCE = 200;

function scalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

function encodeValue(value) {
  if (value && typeof value.toMillis === 'function') {
    return { type: 'timestamp', millis: value.toMillis() };
  }
  if (typeof value === 'string') return { type: 'string', value };
  if (typeof value === 'number' && Number.isFinite(value)) return { type: 'number', value };
  throw new HttpError(400, 'invalid_cursor');
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'invalid_cursor');
  if (value.type === 'timestamp' && Number.isFinite(value.millis)) return Timestamp.fromMillis(value.millis);
  if (value.type === 'string' && typeof value.value === 'string') return value.value;
  if (value.type === 'number' && Number.isFinite(value.value)) return value.value;
  throw new HttpError(400, 'invalid_cursor');
}

function encodeCursor(positions) {
  return Buffer.from(JSON.stringify({ version: 1, positions }), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return {};
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (payload?.version !== 1 || !payload.positions || typeof payload.positions !== 'object') {
      throw new Error('shape');
    }
    const positions = {};
    for (const [field, position] of Object.entries(payload.positions)) {
      if (!DATE_FIELDS.includes(field) || !position || typeof position.id !== 'string') throw new Error('position');
      positions[field] = { value: decodeValue(position.value), id: position.id };
    }
    return positions;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_cursor');
  }
}

function queryParams(req) {
  const rawLimit = Number(scalar(req.query?.limit) ?? 25);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
    throw new HttpError(400, 'invalid_request');
  }
  const type = String(scalar(req.query?.type) || 'all');
  if (!['all', 'coupon', 'affiliate'].includes(type)) throw new HttpError(400, 'invalid_request');
  const code = String(scalar(req.query?.code) || '').trim();
  if (code.length > 64) throw new HttpError(400, 'invalid_request');
  const cursor = String(scalar(req.query?.cursor) || '');
  if (cursor.length > 4096) throw new HttpError(400, 'invalid_cursor');
  return { limit: rawLimit, type, code, cursor };
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['GET'] })) return;

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(req, {
      scope: 'admin-coupon-usage',
      limit: 120,
      windowMs: 60 * 60 * 1000,
      identity: admin.uid,
    });
    const params = queryParams(req);
    const previous = decodeCursor(params.cursor);
    const orders = adminDb().collection('orders');

    const snapshots = await Promise.all(DATE_FIELDS.map(async (field) => {
      let query = orders.orderBy(field, 'desc').orderBy(FieldPath.documentId(), 'desc');
      const position = previous[field];
      if (position) query = query.startAfter(position.value, position.id);
      const snapshot = await query.limit(MAX_SCAN_PER_SOURCE + 1).get();
      return { field, docs: snapshot.docs };
    }));

    const merged = snapshots
      .flatMap(({ field, docs }) => docs.map((document) => ({
        field,
        document,
        order: { id: document.id, ...document.data() },
      })))
      .sort((left, right) => {
        const byDate = orderEpoch(right.order) - orderEpoch(left.order);
        return byDate || right.document.id.localeCompare(left.document.id);
      });

    const positions = { ...previous };
    const rows = [];
    const seen = new Set();
    let consumed = 0;

    for (const entry of merged) {
      if (rows.length >= params.limit && !seen.has(entry.document.id)) break;
      positions[entry.field] = {
        value: entry.document.get(entry.field),
        id: entry.document.id,
      };
      consumed += 1;
      if (seen.has(entry.document.id)) continue;
      seen.add(entry.document.id);
      const row = couponRow(entry.order);
      if (matchesCouponFilters(row, params.type, params.code)) rows.push(row);
    }

    const hasMore = consumed < merged.length
      || snapshots.some(({ docs }) => docs.length > MAX_SCAN_PER_SOURCE);
    const serializedPositions = Object.fromEntries(
      Object.entries(positions).map(([field, position]) => [field, {
        value: encodeValue(position.value),
        id: position.id,
      }]),
    );

    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({
      ok: true,
      items: rows,
      hasMore,
      nextCursor: hasMore ? encodeCursor(serializedPositions) : null,
      scope: 'loaded',
    });
  } catch (error) {
    console.error('[admin-coupon-usage]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
