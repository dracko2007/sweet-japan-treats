import { randomUUID } from 'node:crypto';
import { requireCronSecret } from './_lib/auth.js';
import { isBlockedFrom30 } from './_lib/cart-recovery-profile.js';
import { isOptedOut } from './_lib/email-optout.js';
import { adminAuth, adminDb } from './_lib/firebase-admin.js';
import { escapeHtml, handleCors, sendError } from './_lib/http.js';
import { sendMail, siteOrigin, unsubscribeUrl, wrapEmail } from './_lib/mailer.js';

const CLAIM_TTL_MS = 10 * 60 * 1000;

// 4 toques de recuperação, todos avaliados no MESMO cron diário (Vercel Hobby
// só permite 1x/dia) — cada carrinho avança no máximo 1 estágio por execução,
// calculado pelo tempo TOTAL decorrido desde `abandonedAt`, não pelo intervalo
// entre execuções do cron. `reminderStage` no doc = último estágio já enviado
// (0 = nenhum ainda). STAGES[reminderStage] = definição do PRÓXIMO estágio devido.
//
// Cadência pedida pelo dono: os três e-mails de desconto (10% → 15% → 30%)
// saem de 3 em 3 dias — como os thresholds são tempo total, isso vira 3, 6 e 9
// dias. Depois do estágio 4 não sai mais nada: `dueStage` devolve null assim
// que `reminderStage >= STAGES.length`, e o próprio filtro da consulta tira o
// documento da fila. O toque de 90 minutos continua sem cupom porque quem só
// esqueceu a aba aberta volta sozinho — dar desconto ali é queimar margem.
// Margem conferida em 26/07/2026 sobre 273 produtos com custo cadastrado —
// com 30% a margem mediana ainda é 29%.
//
// Oferecer 30% de forma previsível ensina o cliente a abandonar o carrinho de
// propósito; quem já comprou usando esse cupom fica com teto de 15% (ver
// `_lib/cart-recovery-profile.js`).
const STAGES = [
  { stage: 1, thresholdMs: 90 * 60 * 1000, discount: null, validadeMs: 0 },
  { stage: 2, thresholdMs: 3 * 24 * 60 * 60 * 1000, discount: 10, validadeMs: 48 * 60 * 60 * 1000 },
  { stage: 3, thresholdMs: 6 * 24 * 60 * 60 * 1000, discount: 15, validadeMs: 48 * 60 * 60 * 1000 },
  { stage: 4, thresholdMs: 9 * 24 * 60 * 60 * 1000, discount: 30, validadeMs: 24 * 60 * 60 * 1000 },
];

/**
 * Cria o cupom de recuperação para este cliente.
 *
 * O código é fixo e legível (`CARRINHO30`), como pedido — dá para ditar por
 * telefone ou WhatsApp. O que impede o óbvio ("CARRINHO30" é trivial de
 * adivinhar) é o `targetType: 'specific'`: só funciona nas contas que de fato
 * abandonaram um carrinho e receberam o e-mail. A cada envio o endereço entra
 * em `targetEmails`; quem digitar o código sem estar na lista é recusado por
 * `api/orders.js:resolveCoupon`.
 *
 * O valor 'specific' NÃO é decorativo: `checkTargetEligibility` e o servidor
 * comparam exatamente essa string, e qualquer outra (já usei 'email' aqui por
 * engano) cai no `return true` final — liberando o cupom para todo mundo.
 *
 * Vale para o CARRINHO INTEIRO — diferente das campanhas de produto, que o
 * servidor restringe ao `campaign.productId`.
 *
 * Antes os estágios usavam `VOLTA10` e `VOLTA15`, que precisavam existir à mão
 * no Firestore — e o `VOLTA10` nunca foi criado, então o estágio 2 prometia um
 * desconto que dava erro no checkout. Aqui o documento é criado/atualizado no
 * mesmo passo do envio, então a promessa nunca existe sem o cupom.
 */
async function garantirCupom(email, discount, validadeMs) {
  const code = `CARRINHO${discount}`;
  const ref = adminDb().collection('coupons').doc(code);
  const atual = (await ref.get()).data();
  const alvos = Array.isArray(atual?.targetEmails) ? atual.targetEmails : [];
  const expiraEm = Date.now() + validadeMs;

  await ref.set({
    code,
    type: 'percent',
    discount: 0,               // legado: o valor real fica em discountPercent
    discountPercent: discount,
    description: `Recuperacao de carrinho — ${discount}% OFF no pedido`,
    // A validade acompanha o envio mais recente. Quem recebeu antes e demorou
    // demais perde o desconto — que é o ponto do "finalize agora".
    expiryDate: new Date(expiraEm).toISOString(),
    isActive: true,
    targetType: 'specific',
    targetEmails: alvos.includes(email) ? alvos : [...alvos, email],
    updatedAt: new Date().toISOString(),
    ...(atual ? {} : { usedCount: 0, createdAt: new Date().toISOString() }),
  }, { merge: true });

  return { code, horas: Math.round(validadeMs / 3600000) };
}

function buildRecoveryEmail(stageDef, name, items, cupom, unsub) {
  const rows = Array.isArray(items)
    ? items.slice(0, 5).map((item) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}${Number(item.quantity) > 1 ? ` (${Math.floor(Number(item.quantity))}x)` : ''}</td></tr>`).join('')
    : '';
  const greeting = `<p>Ola${name ? `, <strong>${escapeHtml(name)}</strong>` : ''}.</p><p>Seu carrinho ainda esta esperando:</p><table style="width:100%">${rows}</table>`;
  const cta = `<p style="text-align:center"><a href="${siteOrigin()}/carrinho" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold">Voltar ao carrinho</a></p>`;

  if (!cupom) {
    // Estágio 1: lembrete leve, sem cupom — evita queimar desconto em quem só
    // esqueceu a aba aberta e volta sozinho.
    return {
      subject: 'Esqueceu algo no carrinho? - Japan Express',
      html: wrapEmail(`${greeting}${cta}`, { unsubscribeUrl: unsub }),
    };
  }

  const ultimo = stageDef.stage === STAGES.length;
  const aviso = ultimo
    ? `<p style="margin:6px 0 0;font-size:13px">Esta e a nossa ultima oferta para este carrinho.</p>`
    : '';
  const discountBlock = `<div style="margin:20px 0;padding:18px;border:2px dashed #ec4899;border-radius:12px;text-align:center"><p style="margin:0">Seu cupom exclusivo</p><p style="font-size:26px;font-weight:900;color:#ec4899;margin:8px 0">${escapeHtml(cupom.code)}</p><p style="margin:0"><strong>${stageDef.discount}% de desconto</strong> se voce finalizar nas proximas <strong>${cupom.horas} horas</strong>.</p><p style="margin:6px 0 0;font-size:13px">So funciona nesta conta e vale para um pedido.</p>${aviso}</div>`;
  return {
    subject: ultimo
      ? `Ultima chance: ${stageDef.discount}% OFF por ${cupom.horas}h - Japan Express`
      : `Finalize e ganhe ${stageDef.discount}% OFF - Japan Express`,
    html: wrapEmail(`${greeting}${discountBlock}${cta}`, { unsubscribeUrl: unsub }),
  };
}

/** Estágio devido agora (ou null) com base no `reminderStage` atual e no tempo decorrido. */
function dueStage(data) {
  const current = Number(data.reminderStage) || 0;
  if (current >= STAGES.length) return null;
  const next = STAGES[current];
  const abandonedAt = Number(data.abandonedAt) || 0;
  if (!abandonedAt || Date.now() - abandonedAt < next.thresholdMs) return null;
  return next;
}

/**
 * Trava o documento (transação idempotente) e retorna o estágio devido + dados
 * do carrinho, ou `null` se nada está devido agora ou se já há uma tentativa em
 * andamento (`reminderClaimedAt` recente) de outra execução concorrente.
 */
async function claimCart(document, claimId) {
  const db = adminDb();
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(document.ref);
    const data = snap.data() || {};
    const claimedAt = Number(data.reminderClaimedAt || 0);
    if (claimedAt && Date.now() - claimedAt < CLAIM_TTL_MS) return null;
    const stageDef = dueStage(data);
    if (!stageDef) return null;
    transaction.update(document.ref, { reminderClaimId: claimId, reminderClaimedAt: Date.now() });
    return { data, stageDef };
  });
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['GET', 'POST'] })) return;

  try {
    requireCronSecret(req);
    const db = adminDb();
    // Filtro único (reminderStage < 3) evita exigir índice composto novo —
    // a decisão de qual estágio está devido agora é feita em código, comparando
    // `abandonedAt` com o threshold do próximo estágio (ver dueStage()).
    const snap = await db.collection('abandoned_carts')
      .where('reminderStage', '<', STAGES.length)
      .limit(50)
      .get();

    let sent = 0;
    let skipped = 0;
    for (const document of snap.docs) {
      const claimId = randomUUID();
      const claimed = await claimCart(document, claimId);
      if (!claimed) {
        skipped += 1;
        continue;
      }
      const { data, stageDef } = claimed;
      try {
        const user = await adminAuth().getUser(document.id);
        if (!user.email) throw new Error('missing_email');
        // Quem cancelou a inscricao sai da fila de vez: `reminderStage` no topo
        // tira o carrinho do filtro da consulta. Sem isso o cron reavaliaria o
        // mesmo documento todo dia so para decidir de novo nao enviar nada.
        if (await isOptedOut(user.email)) {
          await document.ref.update({
            reminderStage: STAGES.length,
            reminderOptedOut: true,
            reminderClaimId: null,
            reminderClaimedAt: null,
          });
          skipped += 1;
          continue;
        }
        // Quem comprou usando o cupom de 30% fica com teto de 15% para evitar
        // que aprenda a abandonar carrinho de propósito esperando o desconto máximo.
        // Se estiver bloqueado e o estágio devido é 30%, encerra com `reminderCapped30`
        // marcado para auditoria. Fora disso o carrinho segue normal.
        if (stageDef.discount === 30 && await isBlockedFrom30(document.id)) {
          await document.ref.update({
            reminderStage: STAGES.length,
            reminderCapped30: true,
            reminderClaimId: null,
            reminderClaimedAt: null,
          });
          skipped += 1;
          continue;
        }
        // O cupom nasce antes do envio: se a criação falhar, o e-mail não sai
        // prometendo um código inexistente — o carrinho fica para o próximo cron.
        const cupom = stageDef.discount
          ? await garantirCupom(user.email, stageDef.discount, stageDef.validadeMs)
          : null;
        const unsub = unsubscribeUrl(user.email);
        await sendMail({
          to: user.email,
          ...buildRecoveryEmail(stageDef, user.displayName || '', data.items, cupom, unsub),
          unsubscribe: unsub,
        });
        await document.ref.update({
          reminderStage: stageDef.stage,
          reminderSentAt: Date.now(),
          reminderClaimId: null,
          reminderClaimedAt: null,
        });
        sent += 1;
      } catch {
        await document.ref.update({ reminderClaimId: null, reminderClaimedAt: null }).catch(() => undefined);
        skipped += 1;
      }
    }

    res.status(200).json({ ok: true, sent, skipped, processed: snap.size });
  } catch (error) {
    console.error('[cart-recovery]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
