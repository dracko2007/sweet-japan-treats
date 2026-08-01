import { adminDb } from './firebase-admin.js';

/**
 * Verifica se o cliente está bloqueado de receber o e-mail de 30%.
 *
 * Quem recebeu o cupom de 30% E o usou na compra fica com teto de 15% —
 * `blockedFrom30 === true` nesse caso. Libera-se apenas ao comprar com
 * desconto < 15% (exatamente 15% mantém bloqueado).
 *
 * Se o perfil do cliente ainda não existe, retorna `false` (liberado).
 * Erros de leitura também retornam `false` — a trava nunca deve derrubar
 * a campanha inteira.
 */
export async function isBlockedFrom30(uid) {
  if (!uid) return false;
  try {
    const snap = await adminDb().collection('cart_recovery_profiles').doc(uid).get();
    return snap.data()?.blockedFrom30 === true;
  } catch {
    return false;
  }
}

/**
 * Registra a compra de um cliente, atualizando o perfil de bloqueio de 30%.
 *
 * Regra de bloqueio:
 * - `discountPercent >= 30` → bloqueia de 30% (`blockedFrom30: true`).
 * - `discountPercent < 15` → libera de 30% (`blockedFrom30: false`).
 * - `15 <= discountPercent < 30` → preserva o estado atual (omite a chave com
 *   `merge: true`), porque comprar com 15% é exatamente o teto que a trava
 *   impõe. Usar esse desconto não prova que o cliente parou de esperar o 30%
 *   — prova apenas que está bloqueado e agindo conforme esperado.
 *
 * Sempre atualiza `lastDiscountPercent` e `updatedAt`. Falhas de escrita
 * não lançam — o chamador (fulfillment.js) envolve em try/catch que só loga.
 */
export async function recordPurchaseDiscount(uid, discountPercent) {
  if (!uid) return;
  try {
    const pct = Number.isFinite(discountPercent) ? Number(discountPercent) : 0;
    const update = {
      lastDiscountPercent: pct,
      updatedAt: new Date().toISOString(),
    };
    // Preserva o bloqueio na faixa [15, 30): não escreve `blockedFrom30`
    // quando está nessa faixa, então a chave mantém seu valor anterior com
    // `merge: true`.
    if (pct >= 30) {
      update.blockedFrom30 = true;
    } else if (pct < 15) {
      update.blockedFrom30 = false;
    }
    // else: 15 <= pct < 30, preserva o estado (omite a chave)
    await adminDb().collection('cart_recovery_profiles').doc(uid).set(update, { merge: true });
  } catch {
    // Falha não aborta o fluxo — quem chama deve poder ignorar erro.
  }
}
