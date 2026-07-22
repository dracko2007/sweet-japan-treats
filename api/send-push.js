// Serverless push endpoint — envia notificações Web Push (VAPID) reais para
// clientes inscritos. Segue o mesmo padrão de inicialização do firebase-admin
// usado em /api/send-email.js. A entrega em si é feita pela lib `web-push`
// (protocolo Web Push padrão — não depende do Firebase Cloud Messaging).
import webpush from 'web-push';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function serviceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function firebaseAdminDb() {
  if (!getApps().length) {
    const serviceAccount = serviceAccountFromEnv();
    if (!serviceAccount) {
      const error = new Error('Firebase Admin not configured');
      error.statusCode = 503;
      throw error;
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// Firestore "in" aceita no máximo 30 valores por consulta — faz em lotes.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@japanexpress-store.com';
  if (!publicKey || !privateKey) {
    res.status(503).json({ error: 'Push not configured (VAPID keys missing)' });
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const emails = Array.isArray(body.emails)
      ? [...new Set(body.emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))]
      : [];
    const title = String(body.title || '').trim();
    const message = String(body.body || '').trim();

    if (emails.length === 0) {
      res.status(400).json({ error: 'missing emails' });
      return;
    }
    if (!title || !message) {
      res.status(400).json({ error: 'missing title or body' });
      return;
    }
    if (emails.length > 500) {
      res.status(400).json({ error: 'too many recipients (max 500 per call)' });
      return;
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: body.url || '/',
      icon: body.icon || undefined,
      image: body.image || undefined,
      tag: body.tag || 'promo',
    });

    const db = firebaseAdminDb();
    const subs = [];
    for (const group of chunk(emails, 30)) {
      const snap = await db.collection('push_subscriptions').where('customerEmail', 'in', group).get();
      snap.forEach((d) => subs.push({ id: d.id, ...d.data() }));
    }

    const results = await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
          return { email: s.customerEmail, ok: true };
        } catch (err) {
          // 404/410 = inscrição expirada/revogada no navegador — remove para não tentar de novo.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.collection('push_subscriptions').doc(s.id).delete().catch(() => {});
          }
          return { email: s.customerEmail, ok: false, error: String(err?.body || err?.message || err) };
        }
      })
    );

    const subscribedEmails = new Set(subs.map((s) => s.customerEmail));
    const withoutSubscription = emails.filter((e) => !subscribedEmails.has(e));

    res.status(200).json({
      ok: true,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      withoutSubscription,
      results,
    });
  } catch (e) {
    console.error('[send-push]', e);
    res.status(e?.statusCode || 500).json({ error: String(e?.message || e) });
  }
}
