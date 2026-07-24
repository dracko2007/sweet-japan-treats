import nodemailer from 'nodemailer';
import { HttpError } from './http.js';

export const MAIL_FROM = 'noreply@japanexpress-store.com';
export const MAIL_REPLY_TO = 'contato@japanexpress-store.com';
export const BRAND = 'Japan Express';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function siteOrigin() {
  const configured = String(process.env.APP_ORIGIN || 'https://japanexpress-store.com');
  try {
    return new URL(configured).origin;
  } catch {
    throw new HttpError(503, 'app_origin_misconfigured');
  }
}

export function wrapEmail(inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden"><div style="background:linear-gradient(135deg,#ec4899,#f59e0b);padding:20px;text-align:center;color:#fff"><h1 style="margin:0;font-size:22px">${BRAND}</h1><p style="margin:4px 0 0;font-size:12px;opacity:.9">Importados do Japao</p></div><div style="padding:24px;color:#333;font-size:15px;line-height:1.6">${inner}</div><div style="padding:14px;text-align:center;font-size:11px;color:#777;border-top:1px solid #eee">${BRAND} · ${MAIL_REPLY_TO} · japanexpress-store.com</div></div>`;
}

function transporter() {
  const pass = process.env.NOREPLY_EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  if (!pass) throw new HttpError(503, 'email_not_configured');
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: MAIL_FROM, pass },
  });
}

export async function sendMail({ to, subject, html }) {
  const info = await transporter().sendMail({
    from: `"${BRAND}" <${MAIL_FROM}>`,
    replyTo: MAIL_REPLY_TO,
    to,
    subject,
    html,
  });
  return { accepted: info.accepted, rejected: info.rejected, messageId: info.messageId };
}

function money(value, currency) {
  const amount = Number(value || 0);
  if (currency === 'JPY') return `¥${Math.round(amount).toLocaleString('en-US')}`;
  if (currency === 'EUR') return `€${amount.toFixed(2)}`;
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  return `R$ ${amount.toFixed(2)}`;
}

export function buildOrderEmail(order, { tracking = false, store = false } = {}) {
  const orderNumber = escapeHtml(order.orderNumber || order.id);
  const name = escapeHtml(order.customerName || order.shippingAddress?.name || 'cliente');
  const currency = String(order.currency || 'JPY');
  const rows = Array.isArray(order.items)
    ? order.items.slice(0, 50).map((item) => `<tr><td style="padding:7px;border-bottom:1px solid #eee">${escapeHtml(item.productName || item.name)} × ${Math.max(1, Number(item.quantity || 1))}</td><td style="padding:7px;text-align:right;border-bottom:1px solid #eee">${money(Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)), currency)}</td></tr>`).join('')
    : '';
  const trackingBlock = tracking
    ? `<p><strong>Rastreamento:</strong> ${escapeHtml(order.trackingCode || order.trackingNumber || 'aguardando atualizacao')}</p>`
    : '';
  const address = order.shippingAddress || {};
  const storeBlock = store
    ? `<p><strong>Entrega:</strong> ${escapeHtml([address.postalCode, address.prefecture, address.city, address.address, address.building].filter(Boolean).join(' · '))}</p>`
    : '';
  const subject = tracking
    ? `Pedido enviado - #${orderNumber}`
    : store ? `Novo pedido - #${orderNumber}` : `Pedido recebido - #${orderNumber}`;
  const html = wrapEmail(`<p>Ola, <strong>${name}</strong>.</p><p>${tracking ? 'Seu pedido foi enviado.' : 'Recebemos seu pedido. O pagamento sera confirmado antes da separacao.'}</p>${trackingBlock}<table style="width:100%;border-collapse:collapse">${rows}</table><p style="text-align:right;font-size:18px"><strong>Total: ${money(order.totalPrice ?? order.total, currency)}</strong></p>${storeBlock}<p>Pedido: <strong>${orderNumber}</strong></p>`);
  return { subject, html };
}
