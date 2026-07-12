// Serverless email endpoint. It sends through the Google Workspace (Gmail) SMTP
// account noreply@ and, for account verification, can generate the official
// Firebase Auth verification link.
import nodemailer from 'nodemailer';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Remetente padrão de todos os e-mails transacionais (Google Workspace).
const FROM = 'noreply@japanexpress-store.com';
// Respostas caem numa caixa monitorada (noreply não é lida).
const REPLY_TO = 'contato@japanexpress-store.com';
const BRAND = 'Japan Express';

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const wrap = (inner) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#ec4899,#f59e0b);padding:20px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px">${BRAND}</h1>
      <p style="margin:4px 0 0;font-size:12px;opacity:.9">Importados do Japao</p>
    </div>
    <div style="padding:24px;color:#333;font-size:15px;line-height:1.6">${inner}</div>
    <div style="padding:14px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee">
      ${BRAND} &middot; ${REPLY_TO} &middot; japanexpress-store.com
    </div>
  </div>`;

function siteOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || 'https://japanexpress-store.com';
  try {
    return new URL(origin).origin;
  } catch {
    return 'https://japanexpress-store.com';
  }
}

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

function firebaseAdminAuth() {
  if (!getApps().length) {
    const serviceAccount = serviceAccountFromEnv();
    if (!serviceAccount) {
      const error = new Error('Firebase Admin not configured');
      error.statusCode = 503;
      throw error;
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAuth();
}

function firebaseAdminDb() {
  firebaseAdminAuth(); // garante initializeApp
  return getFirestore();
}

// Anti-abuso p/ e-mails transacionais (recibo/rastreio): o destinatário precisa
// ser o dono de um pedido real no Firestore. Retry curto absorve o lag de sync
// (o pedido é gravado no client logo antes de disparar o e-mail).
async function orderAllowsEmail(orderId, to) {
  if (!orderId) return false;
  const db = firebaseAdminDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = await db.collection('orders').doc(String(orderId)).get();
      if (snap.exists) {
        const d = snap.data() || {};
        const emails = [d.customerEmail, d.email].map((e) => String(e || '').trim().toLowerCase());
        if (emails.includes(to)) return true;
        return false; // pedido existe mas e-mail não bate → não autoriza
      }
    } catch {
      /* tenta de novo */
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

async function buildVerificationLink(email, req) {
  return firebaseAdminAuth().generateEmailVerificationLink(email, {
    url: `${siteOrigin(req)}/login?verified=1`,
    handleCodeInApp: false,
  });
}

function buildTemplate(type, name, code, extra = {}) {
  const safeName = escapeHtml(name);
  const hi = safeName ? `Ola, <strong>${safeName}</strong>!` : 'Ola!';

  if (type === 'verify') {
    const link = escapeHtml(extra.link || '');
    return {
      subject: `Confirme seu e-mail - ${BRAND}`,
      html: wrap(`${hi}<br><br>
        Recebemos seu cadastro na <strong>${BRAND}</strong>.<br>
        Para liberar o acesso, confirme que este e-mail pertence a voce:<br><br>
        <a href="${link}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Confirmar meu e-mail</a><br><br>
        Se o botao nao abrir, copie e cole este link no navegador:<br>
        <span style="word-break:break-all;color:#555">${link}</span><br><br>
        Se voce nao criou esta conta, ignore este e-mail.`),
    };
  }

  if (type === '2fa') {
    const safeCode = escapeHtml(code);
    return {
      subject: `Seu codigo de verificacao: ${safeCode}`,
      html: wrap(`${hi}<br><br>Seu codigo de verificacao e:
        <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#ec4899;text-align:center;margin:18px 0">${safeCode}</div>
        Ele expira em alguns minutos. Se voce nao solicitou, ignore este e-mail.`),
    };
  }

  return {
    subject: `Cadastro recebido - ${BRAND}`,
    html: wrap(`${hi}<br><br>
      Seu cadastro na <strong>${BRAND}</strong> foi recebido.<br><br>
      Para acessar a conta, confirme seu e-mail pelo link de verificacao enviado separadamente.<br><br>
      <a href="https://japanexpress-store.com/login" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">Ir para o login</a><br><br>
      Qualquer duvida, responda este e-mail.`),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // App Password da conta Google Workspace noreply@ (2FA obrigatório na conta).
  const pass = process.env.NOREPLY_EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  if (!pass) {
    res.status(503).json({ error: 'Email not configured' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const to = String(body.to || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      res.status(400).json({ error: 'invalid email' });
      return;
    }

    const type = String(body.type || 'welcome');
    let subject;
    let html;

    if (type === 'transactional') {
      // Recibo de compra / rastreio: o HTML já vem renderizado pelo client.
      // Anti-abuso: só envia se o destinatário for dono de um pedido real
      // (Firestore) OU tiver conta no Firebase Auth — nunca para e-mail arbitrário.
      subject = String(body.subject || '').trim();
      html = String(body.html || '');
      if (!subject || !html) {
        res.status(400).json({ error: 'missing subject or html' });
        return;
      }
      let allowed = await orderAllowsEmail(String(body.orderId || '').trim(), to);
      if (!allowed) {
        try { await firebaseAdminAuth().getUserByEmail(to); allowed = true; } catch { /* não autoriza */ }
      }
      if (!allowed) {
        res.status(400).json({ error: 'invalid request' });
        return;
      }
    } else {
      // verify / 2fa / welcome — âncora: o destinatário precisa existir no Firebase
      // Auth (sem conta real, o endpoint não vira relay aberto). O 2FA é gerado logo
      // após o cadastro, então getUserByEmail já funciona.
      try {
        await firebaseAdminAuth().getUserByEmail(to);
      } catch {
        // Não revela se o email existe ou não — resposta genérica
        res.status(400).json({ error: 'invalid request' });
        return;
      }

      let extra = {};
      let effectiveType = type;
      if (type === 'verify') {
        // Se o link de verificação do Firebase falhar (ex.: domínio não autorizado),
        // não derruba o e-mail: cai para o template de boas-vindas e envia mesmo assim.
        try {
          extra = { link: await buildVerificationLink(to, req) };
        } catch (linkErr) {
          console.warn('[send-email] verify link falhou, enviando welcome:', String(linkErr?.message || linkErr));
          effectiveType = 'welcome';
        }
      }
      ({ subject, html } = buildTemplate(effectiveType, body.name || '', body.code || '', extra));
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: FROM, pass },
    });

    const info = await transporter.sendMail({ from: `"${BRAND}" <${FROM}>`, replyTo: REPLY_TO, to, subject, html });
    res.status(200).json({
      ok: true,
      type,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response,
      messageId: info?.messageId,
    });
  } catch (e) {
    console.error('[send-email]', e);
    res.status(e?.statusCode || 500).json({ error: String(e?.message || e) });
  }
}
