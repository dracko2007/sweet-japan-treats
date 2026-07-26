import { randomBytes } from 'node:crypto';
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
import { sendPush } from './_lib/push.js';
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
  if (type === 'reset') {
    const link = await adminAuth().generatePasswordResetLink(to, {
      url: `${siteOrigin()}/login`,
      handleCodeInApp: false,
    });
    const safeLink = escapeHtml(link);
    return {
      subject: 'Redefinir sua senha - Japan Express',
      html: wrapEmail(`<p>${salutation}</p><p>Recebemos um pedido para redefinir a senha da sua conta.</p><p><a href="${safeLink}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Criar nova senha</a></p><p style="word-break:break-all">${safeLink}</p><p>O link vale por tempo limitado. Se voce nao pediu isso, ignore esta mensagem: sua senha atual continua valendo.</p>`),
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

const MECHANICS = new Set(['none', 'discount', 'bogo', 'bogo_other', 'points', 'coupon']);
const CHANNELS = new Set(['email', 'app', 'both']);

function integer(value, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new HttpError(400, 'invalid_request');
  return parsed;
}

function cleanCampaign(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'invalid_request');
  assertExactKeys(raw, ['mechanic', 'productId', 'giftProductId', 'couponCode', 'discountPct', 'keepProductDiscount', 'points', 'expiresInDays']);
  const mechanic = requiredText(raw.mechanic, { max: 20 });
  if (!MECHANICS.has(mechanic)) throw new HttpError(400, 'invalid_request');
  return {
    mechanic,
    productId: optionalText(raw.productId, { max: 120 }),
    giftProductId: optionalText(raw.giftProductId, { max: 120 }),
    couponCode: optionalText(raw.couponCode, { max: 40 }).toUpperCase(),
    discountPct: mechanic === 'discount' ? integer(raw.discountPct, 1, 90) : 0,
    keepProductDiscount: raw.keepProductDiscount === true,
    points: mechanic === 'points' ? integer(raw.points, 1, 100000) : 0,
    expiresInDays: raw.expiresInDays === undefined ? 30 : integer(raw.expiresInDays, 1, 90),
  };
}

function offerFor(campaign, product, giftProduct) {
  const productName = String(product?.name || 'produto selecionado');
  if (campaign.mechanic === 'discount') return { badge: `-${campaign.discountPct}%`, tagline: `${campaign.discountPct}% de desconto`, description: `Aproveite ${productName} com ${campaign.discountPct}% de desconto.` };
  if (campaign.mechanic === 'bogo') return { badge: 'COMPRE 1 GANHE 1', tagline: 'Compre 1 e ganhe 1', description: `Compre ${productName} e leve duas unidades.` };
  if (campaign.mechanic === 'bogo_other') return { badge: 'COMPRE E GANHE', tagline: 'Compre e ganhe outro produto', description: `Compre ${productName} e ganhe ${String(giftProduct?.name || 'outro produto')}.` };
  if (campaign.mechanic === 'points') return { badge: `+${campaign.points} PONTOS`, tagline: 'Compre e ganhe pontos', description: `Compre ${productName} e ganhe ${campaign.points} pontos.` };
  if (campaign.mechanic === 'coupon') return { badge: `CUPOM ${campaign.couponCode}`, tagline: 'Compre e ganhe um cupom', description: `Compre ${productName} e receba o cupom ${campaign.couponCode} para a proxima compra.` };
  return { badge: 'OFERTA', tagline: 'Oferta especial', description: `Confira ${productName}.` };
}

function promoEmail({ subject, headline, extraMessage, ctaLabel, offer, product, url }) {
  const image = product?.thumbnail || product?.image;
  const imageHtml = image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" style="width:100%;max-height:320px;object-fit:contain">` : '';
  return {
    subject,
    html: wrapEmail(`<h2>${escapeHtml(headline)}</h2>${imageHtml}<h3>${escapeHtml(product?.name || '')}</h3><div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px"><strong>${escapeHtml(offer.badge)}</strong><br>${escapeHtml(offer.tagline)}<p>${escapeHtml(offer.description)}</p></div><p>${escapeHtml(extraMessage)}</p><p style="text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold">${escapeHtml(ctaLabel)}</a></p>`),
  };
}

async function handleEmail(req, res) {
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

    // Reenvio pelo painel do admin. Existe porque o caminho normal depende da
    // sessão do próprio cliente estar viva no navegador dele — e quando isso
    // falha, a conta é criada e NINGUÉM fica sabendo que o link não saiu. Aqui
    // quem autentica é o admin, então dá para destravar qualquer cliente já
    // cadastrado sem depender de nada do lado dele.
    if (type === 'verify-admin') {
      assertExactKeys(body, ['type', 'to', 'name']);
      const admin = await requireAdmin(req);
      await enforceRateLimit(req, { scope: 'email:verify-admin', limit: 60, windowMs: 60 * 60 * 1000, identity: admin.uid });
      const to = normalizeEmail(body.to);
      const template = await accountTemplate('verify', to, optionalText(body.name, { max: 100 }));
      const result = await sendMail({ to, ...template });
      res.status(200).json({ ok: true, type, ...result });
      return;
    }

    // Recuperacao de senha. Unico tipo que NAO exige sessao — quem esqueceu a
    // senha nao consegue entrar para provar quem e. Antes isso saia pelo
    // Firebase, de noreply@<projeto>.firebaseapp.com com o assunto
    // "Reset your password for <nome do projeto>": remetente desconhecido para
    // o cliente, fora do dominio autenticado por SPF/DKIM da loja e invisivel
    // na caixa de Enviados. Agora sai pelo mesmo caminho dos demais.
    if (type === 'password-reset') {
      assertExactKeys(body, ['type', 'to']);
      const to = normalizeEmail(body.to);
      // Dois limites, porque o endpoint e aberto: por IP trava a varredura de
      // contas; por e-mail impede encher a caixa de uma vitima especifica.
      await enforceRateLimit(req, { scope: 'email:password-reset:ip', limit: 10, windowMs: 60 * 60 * 1000 });
      await enforceRateLimit(req, { scope: 'email:password-reset:conta', limit: 4, windowMs: 60 * 60 * 1000, identity: to });
      try {
        const template = await accountTemplate('reset', to);
        await sendMail({ to, ...template });
      } catch (error) {
        // Conta inexistente responde exatamente como um envio bem-sucedido.
        // Revelar a diferenca transformaria este endpoint numa sonda para
        // descobrir quais e-mails tem conta na loja. Qualquer OUTRA falha
        // propaga normalmente, para o cliente poder reagir.
        if (error?.code !== 'auth/user-not-found') throw error;
      }
      res.status(200).json({ ok: true, type });
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

async function handlePush(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(req, {
      scope: 'send-push',
      limit: 30,
      windowMs: 60 * 60 * 1000,
      identity: admin.uid,
    });

    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['emails', 'title', 'body', 'url', 'tag']);
    if (!Array.isArray(body.emails) || body.emails.length < 1 || body.emails.length > 500) {
      throw new HttpError(400, 'invalid_recipients');
    }
    const emails = body.emails.map(normalizeEmail);
    const result = await sendPush({
      emails,
      title: requiredText(body.title, { max: 100 }),
      body: requiredText(body.body, { max: 300 }),
      url: optionalText(body.url, { max: 500 }) || '/',
      tag: optionalText(body.tag, { max: 50 }) || 'promo',
    });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[send-push]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}

async function handlePromoCampaign(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(req, { scope: 'promo-campaign', limit: 10, windowMs: 60 * 60 * 1000, identity: admin.uid });
    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['campaign', 'recipients', 'channel', 'subject', 'headline', 'extraMessage', 'ctaLabel', 'cancelHomePromotion']);
    const campaign = cleanCampaign(body.campaign);
    const channel = requiredText(body.channel, { max: 10 });
    if (!CHANNELS.has(channel)) throw new HttpError(400, 'invalid_request');
    if (!Array.isArray(body.recipients) || body.recipients.length < 1 || body.recipients.length > 500) throw new HttpError(400, 'invalid_recipients');
    const recipients = [...new Set(body.recipients.map(normalizeEmail))];
    const subject = requiredText(body.subject, { max: 140 });
    const headline = requiredText(body.headline, { max: 160 });
    const extraMessage = requiredText(body.extraMessage, { max: 600 });
    const ctaLabel = requiredText(body.ctaLabel, { max: 80 });

    const db = adminDb();
    const productSnap = campaign.productId ? await db.collection('products').doc(campaign.productId).get() : null;
    if (campaign.productId && !productSnap?.exists) throw new HttpError(400, 'invalid_product');
    const product = productSnap?.data() || null;
    let giftProduct = null;
    if (campaign.mechanic === 'bogo_other') {
      if (!campaign.giftProductId) throw new HttpError(400, 'invalid_gift_product');
      const giftSnap = await db.collection('products').doc(campaign.giftProductId).get();
      if (!giftSnap.exists) throw new HttpError(400, 'invalid_gift_product');
      giftProduct = giftSnap.data();
    }
    if (campaign.mechanic === 'coupon' && !campaign.couponCode) throw new HttpError(400, 'invalid_coupon');

    const code = `PROMO-${randomBytes(3).toString('hex').toUpperCase()}`;
    const now = Date.now();
    const offer = offerFor(campaign, product, giftProduct);
    const stored = {
      code,
      ...campaign,
      ...offer,
      productName: product?.name || '',
      productImage: product?.thumbnail || product?.image || '',
      createdAt: now,
      createdBy: admin.uid,
      expiresAt: now + campaign.expiresInDays * 86400000,
      active: true,
      perCpfLimit: 1,
    };
    delete stored.expiresInDays;

    const campaignRef = db.collection('promo_campaigns').doc(code.toLowerCase());
    const feedRef = db.collection('siteContent').doc('promoNotifications');
    await db.runTransaction(async (transaction) => {
      const feedSnap = await transaction.get(feedRef);
      const previous = Array.isArray(feedSnap.data()?.items) ? feedSnap.data().items : [];
      transaction.create(campaignRef, stored);
      transaction.set(feedRef, {
        items: [{ code, ...offer, productId: campaign.productId || '', productName: product?.name || '', productImage: product?.thumbnail || product?.image || '', createdAt: now, expiresAt: stored.expiresAt }, ...previous].slice(0, 10),
        updatedAt: now,
      });
      if (body.cancelHomePromotion === true) transaction.delete(db.collection('siteContent').doc('homePromotion'));
    });

    const path = campaign.productId ? `/produto/${encodeURIComponent(campaign.productId)}?promo=${encodeURIComponent(code)}` : `/?promo=${encodeURIComponent(code)}`;
    const url = `${siteOrigin()}${path}`;
    const results = [];
    if (channel === 'email' || channel === 'both') {
      const template = promoEmail({ subject, headline, extraMessage, ctaLabel, offer, product, url });
      for (const to of recipients) {
        try {
          await sendMail({ to, ...template });
          results.push({ email: to, channel: 'email', ok: true });
        } catch {
          results.push({ email: to, channel: 'email', ok: false });
        }
      }
    }
    let push = null;
    if (channel === 'app' || channel === 'both') {
      push = await sendPush({ emails: recipients, title: offer.tagline, body: offer.description, url: path });
      results.push(...push.results.map((result) => ({ ...result, channel: 'app' })));
    }

    res.status(200).json({ ok: true, code, results, push });
  } catch (error) {
    console.error('[promo-campaign]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}

export default async function handler(req, res) {
  const { action } = req.query;
  if (action === 'email') return handleEmail(req, res);
  if (action === 'push') return handlePush(req, res);
  if (action === 'promo-campaign') return handlePromoCampaign(req, res);
  return res.status(400).json({ error: 'invalid_action' });
}

export { handleEmail, handlePush, handlePromoCampaign };
