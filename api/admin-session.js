import { createHash, timingSafeEqual } from 'node:crypto';
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

// Autentica exclusivamente SUB-ADMINS (username + senha, migrados para conta
// Firebase Auth real). O super-admin (dracko2007@gmail.com) autentica direto
// no Identity Toolkit a partir do client (src/services/adminService.ts) —
// sem depender desta função serverless, então login continua funcionando
// mesmo sem `vercel dev`/API local.

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function passwordMatches(received, expected) {
  return typeof expected === 'string' && expected.length > 0
    && timingSafeEqual(digest(received), digest(expected));
}

function firebaseApiKey() {
  const key = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!key) throw new HttpError(503, 'admin_auth_not_configured');
  return key;
}

async function passwordSignIn(email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new HttpError(401, 'invalid_credentials');
  const payload = await response.json();
  if (!payload.localId) throw new HttpError(401, 'invalid_credentials');
  return payload.localId;
}

function adminUid(username) {
  return `admin_${createHash('sha256').update(username).digest('hex').slice(0, 24)}`;
}

function adminEmail(username) {
  const id = createHash('sha256').update(username).digest('hex').slice(0, 32);
  return `admin-${id}@auth.japanexpress-store.com`;
}

async function migratedAdmin(username, password) {
  const db = adminDb();
  const query = await db.collection('admins').where('username', '==', username).limit(1).get();
  if (query.empty) return null;
  const document = query.docs[0];
  const data = document.data();
  if (data.active !== true || !data.authEmail) throw new HttpError(401, 'invalid_credentials');
  const uid = await passwordSignIn(data.authEmail, password);
  if (uid !== document.id) throw new HttpError(401, 'invalid_credentials');
  return { uid, username, name: data.name || username, role: Number(data.role) || 1 };
}

async function migrateLegacyAdmin(username, password) {
  const db = adminDb();
  const legacyRef = db.collection('admins').doc(username);
  const legacy = await legacyRef.get();
  if (!legacy.exists) return null;
  const data = legacy.data() || {};
  if (data.active === false || !passwordMatches(password, data.password)) {
    throw new HttpError(401, 'invalid_credentials');
  }

  const uid = adminUid(username);
  const authEmail = adminEmail(username);
  const role = Math.max(1, Math.min(3, Math.floor(Number(data.role) || 1)));
  const auth = adminAuth();
  try {
    await auth.createUser({ uid, email: authEmail, password, displayName: data.name || username });
  } catch (error) {
    if (error?.code !== 'auth/uid-already-exists' && error?.code !== 'auth/email-already-exists') throw error;
    await auth.updateUser(uid, { password, displayName: data.name || username });
  }
  await auth.setCustomUserClaims(uid, { admin: true, role: 'admin', adminRole: role });

  const adminRef = db.collection('admins').doc(uid);
  const batch = db.batch();
  batch.set(adminRef, {
    username,
    name: data.name || username,
    role,
    active: true,
    authEmail,
    addedAt: data.addedAt || new Date().toISOString(),
    addedBy: data.addedBy || 'legacy-migration',
    migratedAt: new Date().toISOString(),
  });
  if (legacyRef.path !== adminRef.path) batch.delete(legacyRef);
  await batch.commit();
  return { uid, username, name: data.name || username, role };
}

async function authenticate(identifier, password) {
  const normalized = slug(identifier);
  return await migratedAdmin(normalized, password)
    || await migrateLegacyAdmin(normalized, password);
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;
  try {
    await enforceRateLimit(req, {
      scope: 'admin-session',
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['identifier', 'password']);
    const identifier = requiredText(body.identifier, { max: 254 });
    const password = requiredText(body.password, { max: 256 });
    const admin = await authenticate(identifier, password);
    if (!admin) throw new HttpError(401, 'invalid_credentials');
    const customToken = await adminAuth().createCustomToken(admin.uid, {
      admin: true,
      role: 'admin',
      adminRole: admin.role,
    });
    res.status(200).json({
      ok: true,
      customToken,
      admin: { username: admin.username, name: admin.name, role: admin.role },
    });
  } catch (error) {
    console.error('[admin-session]', error instanceof Error ? error.message : error);
    sendError(res, error instanceof HttpError ? error : new HttpError(401, 'invalid_credentials'));
  }
}
