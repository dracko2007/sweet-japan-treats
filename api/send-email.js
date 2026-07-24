import { requireAdmin, requireUser } from './_lib/auth.js';
import { adminAuth, adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  normalizeEmail,
  optionalText,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { buildOrderEmail, escapeHtml, sendMail, siteOrigin, wrapEmail } from './_lib/mailer.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

async function accountTemplate(type, to, name) {
  const safeName = escapeHtml(name);
  const salutation = safeName ? `Ola, <strong>${safeName}</strong>.` : 'Ola.';
  if (type === 'verify') {
    const link = await adminAuth().generateEmailVerificationLink(to, {
      url: `${siteOrigin()}/login?verified=1`,
      handleCodeInApp: false,
    });
    const safeLink = escapeHtml(link);
    return {
      subject: 'Confirme seu e-mail - Japan Express',
      html: wrapEmail(`<p>${salutation}</p><p>Confirme que este e-mail pertence a voce:</p><p><a href="${safeLink}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Confirmar meu e-mail</a></p><p style="word-break:break-all">${safeLink}</p><p>Se voce nao criou esta conta, ignore esta mensagem.</p>`),
    };
  }
  return {
    subject: 'Cadastro recebido - Japan Express',
    html: wrapEmail(`<p>${salutation}</p><p>Seu cadastro foi recebido. Confirme seu e-mail antes de entrar na loja.</p><p><a href="${siteOrigin()}/login">Ir para o login</a></p>`),
  };
}

async function loadOrder(orderId) {
  const snap = await adminDb().collection('orders').doc(orderId).get();
  if (!snap.exists) throw new HttpError(404, 'order_not_found');
  return { id: snap.id, ...snap.data() };
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const body = parseJsonObject(req.body);
    const type = requiredText(body.type, { max: 20 });

    if (type === 'verify' || type === 'welcome') {
      assertExactKeys(body, ['type', 'to', 'name']);
      const user = await requireUser(req);
      const to = normalizeEmail(body.to);
      if (!user.email || normalizeEmail(user.email) !== to) throw new HttpError(403, 'forbidden');
      await enforceRateLimit(req, { scope: `email:${type}`, limit: 4, windowMs: 60 * 60 * 1000, identity: user.uid });
      const template = await accountTemplate(type, to, optionalText(body.name, { max: 100 }));
      const result = await sendMail({ to, ...template });
      res.status(200).json({ ok: true, type, ...result });
      return;
    }

    if (type === 'order') {
      assertExactKeys(body, ['type', 'orderId']);
      const user = await requireUser(req);
      const order = await loadOrder(requiredText(body.orderId, { max: 80, pattern: /^[A-Za-z0-9_-]+$/ }));
      const ownerEmail = String(order.customerEmail || order.email || '').toLowerCase();
      if (order.userId !== user.uid && ownerEmail !== String(user.email || '').toLowerCase()) {
        throw new HttpError(403, 'forbidden');
      }
      await enforceRateLimit(req, { scope: 'email:order', limit: 12, windowMs: 60 * 60 * 1000, identity: user.uid });
      const template = buildOrderEmail(order);
      const result = await sendMail({ to: normalizeEmail(ownerEmail), ...template });
      res.status(200).json({ ok: true, type, ...result });
      return;
    }

    if (type === 'tracking' || type === 'store') {
      assertExactKeys(body, ['type', 'orderId']);
      const admin = await requireAdmin(req);
      await enforceRateLimit(req, { scope: `email:${type}`, limit: 200, windowMs: 60 * 60 * 1000, identity: admin.uid });
      const order = await loadOrder(requiredText(body.orderId, { max: 80, pattern: /^[A-Za-z0-9_-]+$/ }));
      const to = type === 'store'
        ? normalizeEmail(process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL)
        : normalizeEmail(order.customerEmail || order.email);
      const template = buildOrderEmail(order, { tracking: type === 'tracking', store: type === 'store' });
      const result = await sendMail({ to, ...template });
      res.status(200).json({ ok: true, type, ...result });
      return;
    }

    throw new HttpError(400, 'unsupported_email_type');
  } catch (error) {
    console.error('[send-email]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
