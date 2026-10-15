import { encodeEmail, unsubscribeToken } from './email-optout.js';
import { escapeHtml, HttpError } from './http.js';

export const MAIL_FROM = 'noreply@japanexpress-store.com';
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
export async function sendMail({ to, subject, html, unsubscribe = '' }) {
  const chave = chaveResend();
  const corpo = {
    from: `"${BRAND}" <${MAIL_FROM}>`,
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
