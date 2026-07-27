import { randomUUID } from 'node:crypto';
import { requireCronSecret } from './_lib/auth.js';
import { adminAuth, adminDb } from './_lib/firebase-admin.js';
import { handleCors, sendError } from './_lib/http.js';
import { escapeHtml, sendMail, siteOrigin, wrapEmail } from './_lib/mailer.js';

const CLAIM_TTL_MS = 10 * 60 * 1000;

// 4 toques de recuperação, todos avaliados no MESMO cron diário (Vercel Hobby
// só permite 1x/dia) — cada carrinho avança no máximo 1 estágio por execução,
// calculado pelo tempo TOTAL decorrido desde `abandonedAt`, não pelo intervalo
// entre execuções do cron. `reminderStage` no doc = último estágio já enviado
// (0 = nenhum ainda). STAGES[reminderStage] = definição do PRÓXIMO estágio devido.
//
// O desconto escala e o de 30% é o ÚLTIMO recurso, a 7 dias: oferecer cedo
// ensina o cliente a abandonar o carrinho de propósito para esperar o cupom.
// Margem conferida em 26/07/2026 sobre 273 produtos com custo cadastrado —
// com 30% a margem mediana ainda é 29%.
const STAGES = [
  { stage: 1, thresholdMs: 90 * 60 * 1000, discount: null, validadeMs: 0 },
  { stage: 2, thresholdMs: 24 * 60 * 60 * 1000, discount: 10, validadeMs: 48 * 60 * 60 * 1000 },
  { stage: 3, thresholdMs: 72 * 60 * 60 * 1000, discount: 15, validadeMs: 48 * 60 * 60 * 1000 },
  { stage: 4, thresholdMs: 7 * 24 * 60 * 60 * 1000, discount: 30, validadeMs: 24 * 60 * 60 * 1000 },
];

/**
 * Cria um cupom exclusivo do cliente, de uso único e com prazo.
 *
 * Antes os estágios usavam códigos fixos (`VOLTA10`, `VOLTA15`) que precisavam
 * existir à mão no Firestore — e o `VOLTA10` simplesmente NÃO existia, então o
 * estágio 2 prometia um desconto que dava erro no checkout. Gerar o cupom aqui
 * elimina essa classe de falha: o código nunca é prometido sem existir.
 *
 * Também é o que dá sentido ao "feche agora": prazo por cliente, não uma data
 * global. E `usageLimit: 1` impede que um cupom de 30% vaze e vire desconto
 * permanente para quem repassar o código.
 */
async function criarCupomPessoal(email, discount, validadeMs) {
  const code = `VOLTA${discount}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const expiraEm = Date.now() + validadeMs;
  await adminDb().collection('coupons').doc(code).set({
    code,
    type: 'percent',
    discount: 0,               // legado: o valor real fica em discountPercent
    discountPercent: discount,
    description: `Recuperacao de carrinho — ${discount}% OFF`,
    expiryDate: new Date(expiraEm).toISOString(),
    isActive: true,
    usageLimit: 1,
    usedCount: 0,
    targetType: 'email',
    targetEmails: [email],
    createdAt: new Date().toISOString(),
  });
  return { code, horas: Math.round(validadeMs / 3600000) };
}

function buildRecoveryEmail(stageDef, name, items, cupom) {
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
      html: wrapEmail(`${greeting}${cta}`),
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
    html: wrapEmail(`${greeting}${discountBlock}${cta}`),
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
        // O cupom nasce antes do envio: se a criação falhar, o e-mail não sai
        // prometendo um código inexistente — o carrinho fica para o próximo cron.
        const cupom = stageDef.discount
          ? await criarCupomPessoal(user.email, stageDef.discount, stageDef.validadeMs)
          : null;
        await sendMail({ to: user.email, ...buildRecoveryEmail(stageDef, user.displayName || '', data.items, cupom) });
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
