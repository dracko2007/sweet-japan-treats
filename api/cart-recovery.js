import { randomUUID } from 'node:crypto';
import { requireCronSecret } from './_lib/auth.js';
import { adminAuth, adminDb } from './_lib/firebase-admin.js';
import { handleCors, sendError } from './_lib/http.js';
import { escapeHtml, sendMail, siteOrigin, wrapEmail } from './_lib/mailer.js';

const CLAIM_TTL_MS = 10 * 60 * 1000;

// 3 toques de recuperação, todos avaliados no MESMO cron diário (Vercel Hobby
// só permite 1x/dia) — cada carrinho avança no máximo 1 estágio por execução,
// calculado pelo tempo TOTAL decorrido desde `abandonedAt`, não pelo intervalo
// entre execuções do cron. `reminderStage` no doc = último estágio já enviado
// (0 = nenhum ainda). STAGES[reminderStage] = definição do PRÓXIMO estágio devido.
const STAGES = [
  { stage: 1, thresholdMs: 90 * 60 * 1000, coupon: null, discount: null },
  { stage: 2, thresholdMs: 24 * 60 * 60 * 1000, coupon: 'VOLTA10', discount: 10 },
  { stage: 3, thresholdMs: 72 * 60 * 60 * 1000, coupon: 'VOLTA15', discount: 15 },
];

function buildRecoveryEmail(stageDef, name, items) {
  const rows = Array.isArray(items)
    ? items.slice(0, 5).map((item) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}${Number(item.quantity) > 1 ? ` (${Math.floor(Number(item.quantity))}x)` : ''}</td></tr>`).join('')
    : '';
  const greeting = `<p>Ola${name ? `, <strong>${escapeHtml(name)}</strong>` : ''}.</p><p>Seu carrinho ainda esta esperando:</p><table style="width:100%">${rows}</table>`;
  const cta = `<p style="text-align:center"><a href="${siteOrigin()}/carrinho" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold">Voltar ao carrinho</a></p>`;

  if (!stageDef.coupon) {
    // Estágio 1: lembrete leve, sem cupom — evita queimar desconto em quem só
    // esqueceu a aba aberta e volta sozinho.
    return {
      subject: 'Esqueceu algo no carrinho? - Japan Express',
      html: wrapEmail(`${greeting}${cta}`),
    };
  }

  const discountBlock = `<div style="margin:20px 0;padding:18px;border:2px dashed #ec4899;border-radius:12px;text-align:center"><p>Use o cupom</p><p style="font-size:26px;font-weight:900;color:#ec4899">${stageDef.coupon}</p><p>${stageDef.discount}% de desconto por tempo limitado.</p></div>`;
  return {
    subject: stageDef.stage >= 3
      ? `Finalize e ganhe ${stageDef.discount}% OFF - Japan Express`
      : `${stageDef.discount}% OFF esperando por você - Japan Express`,
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
        await sendMail({ to: user.email, ...buildRecoveryEmail(stageDef, user.displayName || '', data.items) });
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
