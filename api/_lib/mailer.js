import { encodeEmail, unsubscribeToken } from './email-optout.js';
import { escapeHtml, HttpError } from './http.js';
import { localCarrierLabel } from '../../shared/local-stock.js';
import { COMPANY_PROFILE } from '../../shared/company-profile.js';

// Remetente padrão: subdomínio dedicado ao envio (`mail.`), com reputação
// separada do domínio principal (que recebe e-mail pela Zoho). Endereço de
// gente, não "no-reply" — o Resend e os provedores penalizam no-reply.
export const MAIL_FROM = 'contato@mail.japanexpress-store.com';
// Só a confirmação de cadastro sai daqui: é automática e ninguém responde.
export const MAIL_FROM_NOREPLY = 'noreply@japanexpress-store.com';
export const MAIL_REPLY_TO = 'contato@japanexpress-store.com';
export const BRAND = 'Japan Express';

export function siteOrigin() {
  const configured = String(process.env.APP_ORIGIN || 'https://japanexpress-store.com');
  try {
    return new URL(configured).origin;
  } catch {
    throw new HttpError(503, 'app_origin_misconfigured');
  }
}

/**
 * Link de cancelamento do proprio destinatario. Vale para sempre: e-mail e
 * lido meses depois, e um link expirado significa cliente sem saida a nao ser
 * marcar como spam — que e o pior desfecho possivel para o dominio.
 */
export function unsubscribeUrl(email) {
  return `${siteOrigin()}/api/unsubscribe?e=${encodeEmail(email)}&t=${unsubscribeToken(email)}`;
}

/**
 * `unsubscribeUrl` so e passado em e-mail de marketing. Confirmacao de pedido,
 * redefinicao de senha e verificacao de conta sao transacionais: oferecer
 * "cancelar inscricao" neles promete algo que a loja nao pode cumprir — ela
 * precisa avisar o cliente sobre o pedido dele de qualquer forma.
 */
export function wrapEmail(inner, { unsubscribeUrl: unsubscribe = '' } = {}) {
  const optOut = unsubscribe
    ? `<p style="margin:10px 0 0">Voce recebe estas mensagens porque se cadastrou na loja. <a href="${escapeHtml(unsubscribe)}" style="color:#777;text-decoration:underline">Cancelar inscricao</a> para parar de receber.</p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden"><div style="background:linear-gradient(135deg,#ec4899,#f59e0b);padding:20px;text-align:center;color:#fff"><h1 style="margin:0;font-size:22px">${BRAND}</h1><p style="margin:4px 0 0;font-size:12px;opacity:.9">Importados do Japao</p></div><div style="padding:24px;color:#333;font-size:15px;line-height:1.6">${inner}</div><div style="padding:14px;text-align:center;font-size:11px;color:#777;border-top:1px solid #eee">${BRAND} · ${MAIL_REPLY_TO} · japanexpress-store.com${optOut}</div></div>`;
}

// Envio pela API HTTP do Resend (sem SMTP). Substitui o Gmail/Workspace, que
// exigia caixa real + App Password e recusava o login quando o remetente era
// alias. Pré-requisito: o domínio do remetente verificado no Resend (registros
// SPF/DKIM no DNS). Sem isso a API responde 403.
const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 15_000;

function chaveResend() {
  const chave = String(process.env.RESEND_API_KEY || '').trim();
  if (!chave) throw new HttpError(503, 'email_not_configured');
  return chave;
}

/**
 * Versão em texto puro a partir do HTML.
 *
 * Mensagem só-HTML é um dos sinais de spam mais citados pelos filtros: e-mail
 * legítimo quase sempre traz as duas partes (multipart/alternative). O domínio
 * aqui é novo e ainda sem reputação, e boa parte dos destinatários é
 * Outlook/Hotmail, que são rigorosos com remetente novo — mandar só HTML joga
 * contra sem necessidade nenhuma.
 */
function htmlParaTexto(html) {
  return String(html)
    // Preserva o destino dos links: no texto puro a URL precisa aparecer, senão
    // o cliente que lê em texto fica sem o link de confirmação.
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gis, '$2: $1')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((linha) => linha.trim()).join('\n')
    .trim();
}

/**
 * `unsubscribe` e a MESMA URL que vai no corpo. Passar as duas coisas do mesmo
 * lugar garante que cabecalho e rodape nunca discordem.
 *
 * Os cabecalhos RFC 2369/8058 sao o que faz o Gmail e o Outlook mostrarem o
 * botao nativo "Cancelar inscricao" ao lado do remetente — o caminho que a
 * maioria das pessoas usa em vez de rolar ate o rodape, e que os dois exigem
 * de quem envia em volume. `One-Click` promete que um POST na URL basta, sem
 * tela intermediaria: `api/unsubscribe` cumpre isso.
 */
export async function sendMail({ to, subject, html, unsubscribe = '', from = MAIL_FROM }) {
  const chave = chaveResend();
  const corpo = {
    from: `"${BRAND}" <${from}>`,
    reply_to: MAIL_REPLY_TO,
    to: [to],
    subject,
    text: htmlParaTexto(html),
    html,
    ...(unsubscribe
      ? {
        headers: {
          'List-Unsubscribe': `<${unsubscribe}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }
      : {}),
  };

  const resposta = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  const dados = await resposta.json().catch(() => ({}));

  // 401/403: chave inválida ou restrita, ou domínio do remetente não verificado.
  if (resposta.status === 401 || resposta.status === 403) {
    console.error('[mailer] Resend recusou a credencial/domínio', resposta.status, dados?.message);
    throw new HttpError(503, 'email_auth_failed');
  }
  // 422: validação da API (endereço de destinatário inválido, por exemplo).
  if (resposta.status === 422) {
    throw new HttpError(502, 'email_rejected_by_smtp');
  }
  if (!resposta.ok || !dados.id) {
    console.error('[mailer] Resend falhou', resposta.status, dados?.name, dados?.message);
    throw new HttpError(502, 'email_provider_error');
  }
  return { accepted: [to], rejected: [], messageId: dados.id };
}

function money(value, currency) {
  const amount = Number(value || 0);
  if (currency === 'JPY') return `¥${Math.round(amount).toLocaleString('en-US')}`;
  if (currency === 'EUR') return `€${amount.toFixed(2)}`;
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  return `R$ ${amount.toFixed(2)}`;
}

// Valores do pedido como a tela mostra: inteiro sem centavos (as linhas do
// checkout são inteiras); com fração, duas casas.
function orderMoney(value, currency) {
  const amount = Number(value || 0);
  if (currency === 'JPY') return money(amount, currency);
  const digits = Number.isInteger(amount) ? 0 : 2;
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  const text = amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  if (currency === 'EUR') return `€${text}`;
  if (currency === 'USD') return `$${text}`;
  return `R$ ${text}`;
}

const CARRIER_LABEL = {
  eraito: 'Air Packet / E-Light',
  'kozutsumi-air': 'Pequeno pacote aereo',
  ems: 'EMS',
  yuubin: 'Yu-Pack (Japan Post)',
  yamato: 'Yamato',
  sagawa: 'Sagawa',
};

const PAYMENT_LABEL = {
  wise: 'Wise',
  pix: 'PIX',
  card: 'Cartao',
  paypay: 'PayPay',
  yucho: 'Banco Yucho',
  bank: 'Transferencia bancaria',
};

const cell = 'padding:7px;border-bottom:1px solid #eee';
const row = (label, value, { bold = false } = {}) =>
  `<tr><td style="${cell}">${bold ? `<strong>${label}</strong>` : label}</td>`
  + `<td style="${cell};text-align:right;white-space:nowrap">${bold ? `<strong>${value}</strong>` : value}</td></tr>`;

/**
 * Linhas da conta como o cliente viu no checkout, a partir de `priceBreakdown`
 * (congelado no pedido, já na moeda do pedido). Pedido antigo, sem ele: null.
 */
/** Pedido que sai do estoque que já está no país do cliente, não do Japão. */
const isLocalOrder = (order) => order?.fulfillment === 'local' && Boolean(order.shipFrom);
/** Um pedido, dois envios: parte sai do país do cliente (`item.local`), o resto do Japão. */
const isMixedOrder = (order) => order?.fulfillment === 'mixed' && Boolean(order.shipFrom);

function breakdownRows(order, currency) {
  const pb = order.priceBreakdown;
  if (!pb || typeof pb !== 'object') return null;
  const n = (value) => Number(value) || 0;
  const out = [];
  if (n(pb.subtotal) > 0) out.push(row('Subtotal dos produtos', orderMoney(pb.subtotal, currency)));
  if (n(pb.couponDiscount) > 0) out.push(row(`Cupom${order.couponCode ? ` ${escapeHtml(order.couponCode)}` : ''}`, `− ${orderMoney(pb.couponDiscount, currency)}`));
  if (n(pb.pointsDiscount) > 0) out.push(row('Pontos usados', `− ${orderMoney(pb.pointsDiscount, currency)}`));
  if (n(pb.paymentDiscount) > 0) out.push(row('Desconto do pagamento', `− ${orderMoney(pb.paymentDiscount, currency)}`));
  const carrier = isLocalOrder(order)
    ? localCarrierLabel(order.shipFrom)
    : CARRIER_LABEL[order.shippingCarrier || order.shipping?.carrier] || '';
  // Pedido misto: o frete tem duas partes, uma por remessa.
  const nacional = isMixedOrder(order) ? n(pb.localShipping) : 0;
  const freteJapao = n(pb.shipping) - nacional;
  out.push(row(`Frete${isMixedOrder(order) ? ' do Japao' : ''}${carrier ? ` (${escapeHtml(carrier)})` : ''}`, freteJapao > 0 ? orderMoney(freteJapao, currency) : 'Gratis'));
  if (isMixedOrder(order)) out.push(row(`Frete nacional (${escapeHtml(localCarrierLabel(order.shipFrom))})`, nacional > 0 ? orderMoney(nacional, currency) : 'Gratis'));
  // Taxa Personal Shopper: a tela de revisão a mostra mesmo quando foi isenta (cheia
  // riscada + valor final). O e-mail faz o mesmo, em vez de sumir com a linha.
  if (n(pb.psFeeDiscount) > 0 && n(pb.psFeeGross) > 0) {
    out.push(row('Taxa PS (Personal Shopper)', `<span style="color:#9ca3af;text-decoration:line-through">${orderMoney(pb.psFeeGross, currency)}</span> `
      + (n(pb.psFee) > 0 ? orderMoney(pb.psFee, currency) : '<span style="color:#059669;font-weight:bold">Isenta</span>')));
  } else if (n(pb.psFee) > 0) {
    out.push(row('Taxa PS (Personal Shopper)', orderMoney(pb.psFee, currency)));
  } else if (order.psFeeWaiverApplied === true) {
    // Pedido antigo: só sabia que foi isenta, não o valor cheio.
    out.push(row('Taxa PS (Personal Shopper)', '<span style="color:#059669;font-weight:bold">Isenta</span>'));
  }  if (n(pb.importDuty) > 0) out.push(row('Imposto de importacao dos EUA (pre-pago)', orderMoney(pb.importDuty, currency)));
  if (n(pb.pixIof) > 0 || n(pb.pixBankFee) > 0) {
    if (n(pb.pixIof) > 0) out.push(row('IOF do PIX', orderMoney(pb.pixIof, currency)));
    if (n(pb.pixBankFee) > 0) out.push(row('Tarifa bancaria do PIX', orderMoney(pb.pixBankFee, currency)));
  } else if (n(pb.paymentFee) > 0) {
    out.push(row('Taxa do pagamento', orderMoney(pb.paymentFee, currency)));
  }
  return out.join('');
}

/** Só https: o código de rastreio vem de gente (admin) e vira link no e-mail do cliente. */
function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

const SHIP_STEPS = ['Pagamento confirmado', 'Pedido separado', 'Enviado', 'Entregue'];

/** Linha do tempo em tabela (e-mail não tem CSS moderno): etapas até `current` preenchidas. */
function shippingProgress(current = 2) {
  const cells = SHIP_STEPS.map((label, i) => {
    const done = i < current;
    const now = i === current;
    const bg = done ? '#10b981' : now ? '#ec4899' : '#e5e7eb';
    const color = done || now ? '#ffffff' : '#9ca3af';
    const mark = done ? '&#10003;' : String(i + 1);
    return `<td align="center" style="width:25%;padding:0 2px;vertical-align:top"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${bg};color:${color};font-size:13px;font-weight:bold;margin:0 auto">${mark}</div><div style="margin-top:6px;font-size:11px;line-height:1.3;color:${now ? '#be185d' : '#6b7280'};${now ? 'font-weight:bold' : ''}">${label}</div></td>`;
  }).join('');
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0"><tr>${cells}</tr></table>`;
}

function shippingItemRow(item, order, currency) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const value = item.freeGift ? 'Brinde' : orderMoney(Number(item.price || 0) * quantity, currency);
  const option = item.freeGift ? '' : String(item.variantLabel || '');
  const image = safeHttpsUrl(item.image || item.imageUrl);
  const origem = isMixedOrder(order) && !item.freeGift
    ? `<div style="font-size:12px;color:${item.local ? '#047857' : '#777'}">${item.local ? `Enviado do ${escapeHtml(order.shipFrom)}` : 'Enviado do Japao'}</div>`
    : '';
  const thumb = image
    ? `<img src="${escapeHtml(image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #eee">`
    : '';
  return `<tr><td style="${cell};width:64px;vertical-align:top">${thumb}</td>`
    + `<td style="${cell};vertical-align:top"><strong>${escapeHtml(item.productName || item.name || 'Produto')}</strong>`
    + `${option ? `<div style="font-size:12px;color:#777">${escapeHtml(option)}</div>` : ''}${origem}`
    + `<div style="font-size:12px;color:#777">Quantidade: ${quantity}</div></td>`
    + `<td style="${cell};text-align:right;white-space:nowrap;vertical-align:top">${value}</td></tr>`;
}

/**
 * E-mail "Pedido enviado": tudo o que o cliente precisa na própria mensagem,
 * sem ter de abrir o site. Substitui a versão de duas linhas (só o código).
 *
 * Só afirma o que o pedido sabe: transportadora, código, itens, conta e endereço
 * vêm do pedido; nenhum prazo é inventado (varia por modalidade e destino, e a
 * página de frete é a fonte dele). Link de rastreio só se for https.
 */
export function buildShippingEmail(order) {
  const orderNumber = escapeHtml(order.orderNumber || order.id);
  const name = escapeHtml(order.customerName || order.shippingAddress?.name || 'cliente');
  const currency = String(order.currency || 'JPY');
  const origin = siteOrigin();

  const local = isLocalOrder(order);
  const mixed = isMixedOrder(order);
  const shipFrom = local || mixed ? escapeHtml(order.shipFrom) : '';
  const carrier = local
    ? localCarrierLabel(order.shipFrom)
    : CARRIER_LABEL[order.shippingCarrier || order.shipping?.carrier] || escapeHtml(order.carrier || '') || '';
  const code = String(order.trackingCode || order.trackingNumber || '').trim();
  const trackUrl = safeHttpsUrl(order.trackingUrl) || `${origin}/rastrear`;

  const headline = mixed
    ? 'Seu pedido tem dois envios'
    : local ? `Seu pedido saiu do ${shipFrom}` : 'Seu pedido saiu do Japao';
  const intro = mixed
    ? `Parte dos itens sai do ${shipFrom} e o restante sai do Japao, cada envio com seu frete.`
    : local
      ? `Ele vai por frete nacional, direto do estoque no ${shipFrom}.`
      : 'Ele ja esta com a transportadora e a caminho do seu endereco.';

  const preheader = code
    ? `Pedido #${orderNumber} enviado. Codigo de rastreio: ${escapeHtml(code)}.`
    : `Pedido #${orderNumber} enviado. O codigo de rastreio chega em breve.`;

  const tracking = `<div style="margin:16px 0;padding:16px;border:1px solid #fbcfe8;background:#fdf2f8;border-radius:12px;text-align:center">`
    + `<p style="margin:0;font-size:12px;color:#9d174d;text-transform:uppercase;letter-spacing:.06em">Codigo de rastreio</p>`
    + `<p style="margin:6px 0 2px;font-size:24px;font-weight:bold;font-family:Consolas,Menlo,monospace;color:#831843;word-break:break-all">${code ? escapeHtml(code) : 'Aguardando a transportadora'}</p>`
    + `${carrier ? `<p style="margin:0 0 12px;font-size:13px;color:#6b7280">Transportadora: <strong>${escapeHtml(carrier)}</strong></p>` : '<div style="height:12px"></div>'}`
    + `<a href="${escapeHtml(trackUrl)}" style="display:inline-block;padding:12px 26px;background:#ec4899;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:999px">Rastrear meu pedido</a>`
    + `<p style="margin:10px 0 0;font-size:12px;color:#6b7280">${code ? 'O codigo pode levar algumas horas para aparecer no site da transportadora. ' : ''}Voce tambem acompanha em ${escapeHtml(origin.replace(/^https?:\/\//, ''))}/rastrear.</p></div>`;

  const items = Array.isArray(order.items) ? order.items.slice(0, 50).map((item) => shippingItemRow(item, order, currency)).join('') : '';
  const breakdown = breakdownRows(order, currency) ?? '';
  const total = row('Total', orderMoney(order.totalPrice ?? order.total, currency), { bold: true });
  const summary = `<h3 style="margin:22px 0 6px;font-size:16px;color:#831843">Resumo do pedido</h3>`
    + `<table role="presentation" style="width:100%;border-collapse:collapse">${items}</table>`
    + `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:6px">${breakdown}${total}</table>`;

  const address = order.shippingAddress || {};
  const destination = [address.name, [address.address, address.building].filter(Boolean).join(' - '),
    [address.city, address.prefecture].filter(Boolean).join(' - '), address.postalCode, address.country]
    .filter(Boolean).map(escapeHtml).join('<br>');
  const payment = PAYMENT_LABEL[order.paymentMethod] || '';
  const delivery = `<h3 style="margin:22px 0 6px;font-size:16px;color:#831843">Entrega</h3>`
    + `<p style="margin:0">${destination || 'Endereco informado no pedido'}</p>`
    + `${payment ? `<p style="margin:10px 0 0"><strong>Pagamento:</strong> ${escapeHtml(payment)}</p>` : ''}`
    + `${carrier ? `<p style="margin:4px 0 0"><strong>Envio:</strong> ${escapeHtml(carrier)}</p>` : ''}`;

  // Imposto/inspeção: só quando a entrega cruza fronteira. Texto alinhado ao aviso
  // de tributação do site (shared/tax-disclosure.js): a loja não cobra, a autoridade sim.
  const crossesBorder = !local && String(address.country || '').trim().toLowerCase() !== 'japan'
    && String(address.country || '').trim().toLowerCase() !== 'japao' && currency !== 'JPY';
  const customs = crossesBorder
    ? `<div style="margin:18px 0 0;padding:12px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:10px;font-size:13px;color:#4b5563"><strong>Alfandega e tributos.</strong> Produtos enviados do Japao podem passar por inspecao e ter tributos definidos pela autoridade do pais de destino, cobrados por ela na entrega. A loja nao cobra esses valores no site.</div>`
    : '';

  const next = `<h3 style="margin:22px 0 6px;font-size:16px;color:#831843">O que acontece agora</h3>`
    + `<ol style="margin:0;padding-left:20px;color:#374151"><li>A transportadora atualiza o rastreio a cada etapa do trajeto.</li>`
    + `<li>Quando chegar, confira a embalagem antes de assinar e guarde o codigo ${code ? `<strong>${escapeHtml(code)}</strong> ` : ''}ate receber.</li>`
    + `<li>Recebeu? Marque como recebido na area de pedidos do site e conte para a gente o que achou.</li></ol>`;

  const wa = `https://wa.me/${COMPANY_PROFILE.whatsapp.digits}`;
  const help = `<div style="margin:22px 0 0;padding:14px;border-top:1px solid #eee;font-size:13px;color:#4b5563;text-align:center">`
    + `Precisa de ajuda com o pedido <strong>#${orderNumber}</strong>? Responda este e-mail ou chame no <a href="${escapeHtml(wa)}" style="color:#047857;font-weight:bold">WhatsApp ${escapeHtml(COMPANY_PROFILE.whatsapp.international)}</a>.</div>`;

  const html = wrapEmail(
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#fff">${preheader}</span>`
    + `<p style="margin:0 0 4px;font-size:20px;font-weight:bold;color:#831843">${headline}</p>`
    + `<p style="margin:0">Ola, <strong>${name}</strong>. ${intro}</p>`
    + shippingProgress(2) + tracking + summary + delivery + customs + next + help
  );
  return { subject: `Pedido enviado - #${orderNumber}`, html };
}

export function buildOrderEmail(order, { tracking = false, store = false } = {}) {
  if (tracking && !store) return buildShippingEmail(order);
  const orderNumber = escapeHtml(order.orderNumber || order.id);
  const name = escapeHtml(order.customerName || order.shippingAddress?.name || 'cliente');
  const currency = String(order.currency || 'JPY');
  const items = Array.isArray(order.items)
    ? order.items.slice(0, 50).map((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const value = item.freeGift ? 'Brinde' : orderMoney(Number(item.price || 0) * quantity, currency);
      const option = item.freeGift ? '' : String(item.variantLabel || '');
      const origem = isMixedOrder(order) && !item.freeGift
        ? ` <span style="color:${item.local ? '#047857' : '#777'}">[${item.local ? `enviado do ${escapeHtml(order.shipFrom)}` : 'enviado do Japao'}]</span>`
        : '';
      return row(`${escapeHtml(item.productName || item.name)}${option ? ` <span style="color:#777">(${escapeHtml(option)})</span>` : ''}${origem} × ${quantity}`, value);
    }).join('')
    : '';
  const breakdown = breakdownRows(order, currency);
  const total = row('Total', orderMoney(order.totalPrice ?? order.total, currency), { bold: true });

  const payment = PAYMENT_LABEL[order.paymentMethod] || '';
  const paymentBlock = payment ? `<p><strong>Pagamento:</strong> ${escapeHtml(payment)}</p>` : '';
  // Na Wise o cliente digita o valor em ienes; o mesmo número da tela do pedido.
  const wiseYen = Number(order.priceBreakdown?.wiseYen) || 0;
  const wiseBlock = !tracking && !store && order.paymentMethod === 'wise' && wiseYen > 0 && currency !== 'JPY'
    ? `<div style="margin:12px 0;padding:12px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:10px;text-align:center"><p style="margin:0;font-size:12px;color:#047857">No campo <strong>Valor</strong> da Wise, insira:</p><p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#064e3b">¥ ${Math.round(wiseYen).toLocaleString('en-US')}</p><p style="margin:2px 0 0;font-size:11px;color:#059669">A Wise converte para ${escapeHtml(orderMoney(order.totalPrice ?? order.total, currency))}. Depois de pagar, envie o comprovante pelo contato da loja.</p></div>`
    : '';

  const trackingBlock = tracking
    ? `<p><strong>Rastreamento:</strong> ${escapeHtml(order.trackingCode || order.trackingNumber || 'aguardando atualizacao')}</p>`
    : '';
  const address = order.shippingAddress || {};
  const destination = [address.name, address.postalCode, address.prefecture, address.city, address.address, address.building, address.country]
    .filter(Boolean).map(escapeHtml).join(', ');
  const addressBlock = destination ? `<p><strong>Entrega:</strong> ${destination}</p>` : '';
  const storeBlock = store
    ? `<p><strong>Cliente:</strong> ${escapeHtml(order.customerEmail || address.email || '')}${address.phone ? ` · ${escapeHtml(address.phone)}` : ''}</p>`
    : '';
  // Pedido local: a loja precisa ver de cara que NÃO é para separar no Japão;
  // o cliente fica sabendo que o envio é nacional.
  const shipFrom = isLocalOrder(order) || isMixedOrder(order) ? escapeHtml(order.shipFrom) : '';
  const localBlock = !shipFrom ? '' : isMixedOrder(order) ? (store
    ? `<div style="margin:12px 0;padding:12px;border:2px solid #059669;background:#ecfdf5;border-radius:10px;color:#065f46"><strong>DOIS ENVIOS:</strong> os itens marcados [enviado do ${shipFrom}] saem do estoque de la, por frete nacional; os demais saem do Japao.</div>`
    : `<p style="color:#047857"><strong>Seu pedido tem dois envios:</strong> os itens marcados saem direto do ${shipFrom} e os demais saem do Japao, cada um com seu frete.</p>`) : store
    ? `<div style="margin:12px 0;padding:12px;border:2px solid #059669;background:#ecfdf5;border-radius:10px;color:#065f46"><strong>ENVIAR DO ${shipFrom.toUpperCase()}</strong> — estoque local, frete nacional. Este pedido nao sai do Japao.</div>`
    : `<p style="color:#047857"><strong>Enviado direto do ${shipFrom}</strong>, por frete nacional.</p>`;
  const subject = tracking
    ? `Pedido enviado - #${orderNumber}`
    : store ? `Novo pedido${shipFrom ? (isMixedOrder(order) ? ` (${shipFrom} + Japao)` : ` (enviar do ${shipFrom})`) : ''} - #${orderNumber}` : `Pedido recebido - #${orderNumber}`;
  const table = `<table style="width:100%;border-collapse:collapse">${items}${breakdown ?? ''}${total}</table>`;
  const html = wrapEmail(`<p>Ola, <strong>${name}</strong>.</p><p>${tracking ? 'Seu pedido foi enviado.' : 'Recebemos seu pedido. O pagamento sera confirmado antes da separacao.'}</p>${trackingBlock}${localBlock}${table}${paymentBlock}${wiseBlock}${addressBlock}${storeBlock}<p>Pedido: <strong>${orderNumber}</strong></p>`);
  return { subject, html };
}

/**
 * Motivos de falha na separação, em português, para o e-mail da loja.
 *
 * O código cru (`insufficient_stock`) vai junto entre parênteses: quem opera a
 * loja lê a frase, quem vai depurar precisa do código exato que o
 * `fulfillOrder` lançou.
 */
const MOTIVO_REVISAO = {
  insufficient_stock: 'estoque insuficiente para um ou mais itens',
  product_unavailable: 'produto saiu do catálogo',
  promotion_unavailable: 'promoção esgotada ou encerrada',
  promotion_changed: 'a promoção da home mudou de produto',
  promotion_limit: 'CPF já usou o limite da promoção',
  promotion_already_used: 'promoção já resgatada por este cliente',
  coupon_unavailable: 'cupom expirou ou atingiu o limite de uso',
  coupon_already_used: 'cupom já usado por este e-mail',
  affiliate_unavailable: 'código de afiliado desativado',
  affiliate_coupon_already_used: 'CPF já usou um cupom de afiliado',
  promoter_code_already_used: 'cliente já usou este código de divulgador',
  insufficient_points: 'saldo de pontos ficou abaixo do resgate',
  order_cancelled: 'pedido foi cancelado antes da confirmação',
  order_has_no_items: 'pedido sem itens',
  payment_reference_mismatch: 'a cobrança não bate com o PaymentIntent do pedido',
  payment_reference_reused: 'este PaymentIntent já quitou outro pedido',
  payment_amount_or_currency_mismatch: 'valor ou moeda cobrados divergem do pedido',
};

/**
 * Pedido pago que não pôde ser separado.
 *
 * O dinheiro já entrou e a mercadoria não vai sair — é o pior estado possível
 * do checkout, e até 04/08/2026 ele era silencioso dos dois lados. Por isso são
 * dois e-mails de tom bem diferente:
 *
 * - Cliente: avisa que o pedido travou e promete retorno com prazo. NÃO promete
 *   estorno automático, porque parte dos motivos (estoque parcial, cupom
 *   vencido) a loja resolve mantendo a venda — prometer devolução e depois
 *   entregar o pedido é pior do que não prometer nada.
 * - Loja: é uma ordem de serviço. Traz motivo, valor e o link direto do
 *   PaymentIntent, porque estornar pelo painel do Stripe é o caminho seguro —
 *   tem o contexto todo na tela e não depende de nenhum código nosso.
 */
export function buildPaymentReviewEmail(order, { reason = '', store = false } = {}) {
  const orderNumber = escapeHtml(order.orderNumber || order.id);
  const name = escapeHtml(order.customerName || order.shippingAddress?.name || 'cliente');
  const currency = String(order.currency || 'JPY');
  const valor = money(order.totalPrice ?? order.total, currency);
  const codigo = String(reason || 'fulfillment_failed');

  if (!store) {
    const html = wrapEmail(
      `<p>Ola, <strong>${name}</strong>.</p>`
      + `<p>Recebemos o pagamento do pedido <strong>#${orderNumber}</strong>, mas nao conseguimos concluir a separacao.</p>`
      + `<p><strong>Voce nao precisa fazer nada agora.</strong> Nossa equipe ja foi avisada e entra em contato em ate 1 dia util com a solucao — ajuste do pedido ou estorno integral de ${escapeHtml(valor)}.</p>`
      + `<p>Pedimos desculpas pelo transtorno.</p>`
      + `<p>Pedido: <strong>#${orderNumber}</strong></p>`
    );
    return { subject: `Problema com seu pedido #${orderNumber} - ja estamos resolvendo`, html };
  }

  const descricao = MOTIVO_REVISAO[codigo] || 'falha na separacao';
  const intentId = String(order.stripePaymentIntentId || order.paymentReference || '');
  const linkStripe = /^pi_[A-Za-z0-9_]+$/.test(intentId)
    ? `<p><a href="https://dashboard.stripe.com/payments/${escapeHtml(intentId)}" style="color:#ec4899"><strong>Abrir no Stripe para estornar</strong></a></p>`
    : '<p><em>Sem PaymentIntent registrado no pedido — conferir no painel do Stripe pelo e-mail do cliente.</em></p>';
  const html = wrapEmail(
    `<p style="font-size:17px"><strong>Pedido pago que nao foi separado.</strong></p>`
    + `<p>O cliente ja foi cobrado e avisado de que a loja entra em contato em ate 1 dia util.</p>`
    + `<table style="width:100%;border-collapse:collapse">`
    + `<tr><td style="padding:7px;border-bottom:1px solid #eee">Pedido</td><td style="padding:7px;text-align:right;border-bottom:1px solid #eee"><strong>#${orderNumber}</strong></td></tr>`
    + `<tr><td style="padding:7px;border-bottom:1px solid #eee">Cliente</td><td style="padding:7px;text-align:right;border-bottom:1px solid #eee">${escapeHtml(order.customerEmail || '')}</td></tr>`
    + `<tr><td style="padding:7px;border-bottom:1px solid #eee">Valor cobrado</td><td style="padding:7px;text-align:right;border-bottom:1px solid #eee"><strong>${escapeHtml(valor)}</strong></td></tr>`
    + `<tr><td style="padding:7px;border-bottom:1px solid #eee">Motivo</td><td style="padding:7px;text-align:right;border-bottom:1px solid #eee">${escapeHtml(descricao)} (<code>${escapeHtml(codigo)}</code>)</td></tr>`
    + `</table>`
    + linkStripe
  );
  return { subject: `[ACAO NECESSARIA] Pedido #${orderNumber} pago e nao separado - ${descricao}`, html };
}
