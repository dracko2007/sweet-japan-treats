// Serverless cron endpoint: sends abandoned-cart recovery emails.
// Triggered by Vercel Cron (see vercel.json) or manually with CRON_SECRET.
//
// Fluxo: lê documentos em /abandoned_carts com updatedAt > 90min e sem
// "reminderSent", busca o e-mail do dono no Firebase Auth, envia o lembrete
// e marca reminderSent para não repetir.
import nodemailer from 'nodemailer';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Remetente padrão (Google Workspace); respostas caem numa caixa monitorada.
const FROM = 'noreply@japanexpress-store.com';
const REPLY_TO = 'contato@japanexpress-store.com';
const BRAND = 'Japan Express';
const THRESHOLD_MIN = 90; // carrinhos parados há mais de 90 min

// Incentivo de reconversão: cupom incluído no e-mail de recuperação.
// O código precisa existir na coleção Firestore `coupons` (validado no checkout).
const RECOVERY_COUPON = 'VOLTA15';
const RECOVERY_DISCOUNT = 15; // %

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

function initAdmin() {
  if (!getApps().length) {
    const sa = serviceAccountFromEnv();
    if (!sa) throw new Error('Firebase Admin not configured');
    initializeApp({ credential: cert(sa) });
  }
}

function escapeHtml(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildRecoveryEmail(name, items, origin) {
  const safeName = escapeHtml(name);
  const hi = safeName ? `Ola, <strong>${safeName}</strong>!` : 'Ola!';
  const itemsHtml = items.slice(0, 5).map((it) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">• ${escapeHtml(it.name)}${it.quantity > 1 ? ` (${it.quantity}x)` : ''}</td></tr>`
  ).join('');
  const more = items.length > 5 ? `<tr><td style="padding:6px 0;color:#999">e mais ${items.length - 5} item(ns)...</td></tr>` : '';

  return {
    subject: `Finalize e ganhe ${RECOVERY_DISCOUNT}% OFF! 🎁 Seu carrinho espera - ${BRAND}`,
    html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#ec4899,#f59e0b);padding:20px;text-align:center;color:#fff">
        <h1 style="margin:0;font-size:22px">${BRAND}</h1>
        <p style="margin:4px 0 0;font-size:12px;opacity:.9">Importados do Japao</p>
      </div>
      <div style="padding:24px;color:#333;font-size:15px;line-height:1.6">
        ${hi}<br><br>
        Notamos que voce deixou alguns produtos no seu carrinho. Eles estao guardados e esperando por voce!<br><br>
        <table style="width:100%;font-size:14px;margin:12px 0">${itemsHtml}${more}</table>
        <div style="margin:20px 0;padding:18px;border:2px dashed #ec4899;border-radius:12px;background:#fff5f9;text-align:center">
          <p style="margin:0;font-size:13px;color:#9d174d;font-weight:bold;text-transform:uppercase;letter-spacing:.5px">Presente para voce voltar</p>
          <p style="margin:6px 0 2px;font-size:15px;color:#333">Finalize agora e ganhe <strong>${RECOVERY_DISCOUNT}% OFF</strong> com o cupom:</p>
          <p style="margin:8px 0;font-size:26px;font-weight:900;letter-spacing:2px;color:#ec4899">${RECOVERY_COUPON}</p>
          <p style="margin:0;font-size:11px;color:#999">Valido por tempo limitado. Aplique no checkout.</p>
        </div>
        <div style="text-align:center;margin:20px 0">
          <a href="${origin}/carrinho" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;font-size:16px">Finalizar e economizar ${RECOVERY_DISCOUNT}%</a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center">Recebeu este e-mail por engano? Apenas ignore.</p>
      </div>
    </div>`,
  };
}

export default async function handler(req, res) {
  // Auth: cron header do Vercel OU segredo manual.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  // App Password da conta Google Workspace noreply@ (2FA obrigatório na conta).
  const pass = process.env.NOREPLY_EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  if (!pass) {
    res.status(503).json({ error: 'Email not configured' });
    return;
  }

  try {
    initAdmin();
    const adminAuth = getAuth();
    const adminDb = getFirestore();
    const origin = 'https://japanexpress-store.com';
    const cutoff = Date.now() - THRESHOLD_MIN * 60 * 1000;

    // Busca carrinhos abandonados há mais de 90min, sem lembrete enviado.
    const snap = await adminDb.collection('abandoned_carts')
      .where('abandonedAt', '<=', cutoff)
      .where('reminderSent', '==', false)
      .limit(50)
      .get();

    if (snap.empty) {
      res.status(200).json({ ok: true, sent: 0, message: 'no abandoned carts' });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: FROM, pass },
    });

    let sent = 0;
    let skipped = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const uid = docSnap.id;
      try {
        const userRecord = await adminAuth.getUser(uid);
        const email = userRecord.email;
        if (!email) { skipped++; continue; }

        const { subject, html } = buildRecoveryEmail(
          userRecord.displayName || '',
          data.items || [],
          origin,
        );
        await transporter.sendMail({ from: `"${BRAND}" <${FROM}>`, replyTo: REPLY_TO, to: email, subject, html });

        // Marca como enviado para não repetir.
        await docSnap.ref.update({ reminderSent: true, reminderSentAt: Date.now() });
        sent++;
      } catch {
        skipped++;
      }
    }

    res.status(200).json({ ok: true, sent, skipped, processed: snap.size });
  } catch (e) {
    console.error('[cart-recovery]', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}
