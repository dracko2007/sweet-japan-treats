import { createHash } from 'node:crypto';
import { requireAdmin } from './_lib/auth.js';
import { adminAuth, adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function authEmail(username) {
  const id = createHash('sha256').update(username).digest('hex').slice(0, 32);
  return `admin-${id}@auth.japanexpress-store.com`;
}

function adminUid(username) {
  return `admin_${createHash('sha256').update(username).digest('hex').slice(0, 24)}`;
}

async function effectiveRole(user) {
  if (Number(user.adminRole) === 3) return 3;
  const email = String(user.email || '').toLowerCase();
  const superEmail = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'dracko2007@gmail.com').toLowerCase();
  if (email && email === superEmail) return 3;
  const snap = await adminDb().collection('admins').doc(user.uid).get();
  return snap.exists && snap.data()?.active === true ? Number(snap.data()?.role) || 0 : 0;
}

async function requireManager(req) {
  const user = await requireAdmin(req);
  if (await effectiveRole(user) < 3) throw new HttpError(403, 'forbidden');
  return user;
}

async function listAdmins() {
  const snap = await adminDb().collection('admins').get();
  return snap.docs
    .map((document) => {
      const data = document.data() || {};
      return {
        username: data.username || document.id,
        name: data.name || data.username || document.id,
        role: Math.max(1, Math.min(3, Math.floor(Number(data.role) || 1))),
        addedAt: data.addedAt || '',
        addedBy: data.addedBy || '',
      };
    })
    .sort((left, right) => right.role - left.role || left.name.localeCompare(right.name));
}

async function createAdmin(body, manager) {
  assertExactKeys(body, ['name', 'password', 'role', 'addedBy']);
  const name = requiredText(body.name, { max: 120 });
  const username = slug(name);
  const password = requiredText(body.password, { max: 256 });
  if (password.length < 8) throw new HttpError(400, 'weak_password');
  const role = Math.floor(Number(body.role));
  if (![1, 2, 3].includes(role)) throw new HttpError(400, 'invalid_role');

  const db = adminDb();
  const existing = await db.collection('admins').where('username', '==', username).limit(1).get();
  const legacy = await db.collection('admins').doc(username).get();
  if (!existing.empty || legacy.exists) throw new HttpError(409, 'admin_exists');

  const uid = adminUid(username);
  const email = authEmail(username);
  const auth = adminAuth();
  await auth.createUser({ uid, email, password, displayName: name });
  try {
    await auth.setCustomUserClaims(uid, { admin: true, role: 'admin', adminRole: role });
    await db.collection('admins').doc(uid).create({
      username,
      name,
      role,
      active: true,
      authEmail: email,
      addedAt: new Date().toISOString(),
      addedBy: requiredText(body.addedBy || manager.email || manager.uid, { max: 254 }),
    });
  } catch (error) {
    await auth.deleteUser(uid).catch(() => undefined);
    throw error;
  }
  return { username, name, role };
}

async function removeAdmin(body, manager) {
  assertExactKeys(body, ['username']);
  const username = slug(requiredText(body.username, { max: 254 }));
  const db = adminDb();
  let snap = await db.collection('admins').where('username', '==', username).limit(1).get();
  let document = snap.empty ? null : snap.docs[0];
  if (!document) {
    const legacy = await db.collection('admins').doc(username).get();
    if (legacy.exists) document = legacy;
  }
  if (!document) throw new HttpError(404, 'admin_not_found');
  if (document.id === manager.uid) throw new HttpError(409, 'cannot_remove_self');

  const data = document.data() || {};
  if (String(data.username || document.id).toLowerCase() === String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'dracko2007@gmail.com').toLowerCase()) {
    throw new HttpError(403, 'cannot_remove_super_admin');
  }
  if (document.id.startsWith('admin_')) {
    await adminAuth().revokeRefreshTokens(document.id).catch(() => undefined);
    await adminAuth().deleteUser(document.id).catch((error) => {
      if (error?.code !== 'auth/user-not-found') throw error;
    });
  }
  await document.ref.delete();
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['GET', 'POST', 'DELETE'] })) return;
  try {
    const manager = await requireManager(req);
    await enforceRateLimit(req, {
      scope: `admin-users:${req.method}`,
      limit: req.method === 'GET' ? 120 : 20,
      windowMs: 60 * 60 * 1000,
      identity: manager.uid,
    });

    if (req.method === 'GET') {
      res.status(200).json({ ok: true, admins: await listAdmins() });
      return;
    }
    const body = parseJsonObject(req.body);
    if (req.method === 'POST') {
      res.status(201).json({ ok: true, admin: await createAdmin(body, manager) });
      return;
    }
    await removeAdmin(body, manager);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[admin-users]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
