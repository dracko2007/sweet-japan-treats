// Níveis de pontos: histórico de compra do cliente.
//
// Calcula quanto o cliente gastou em mercadoria (só) nos últimos 3 meses
// para determinar seu multiplicador de pontos. Usa um recorte por
// mês-calendário (o mês atual + os 2 anteriores), não 90 dias corridos.

import { spendWindowStart } from '../../shared/points.js';
import { FieldPath } from 'firebase-admin/firestore';

/**
 * Gasto total em mercadoria (fora frete, fora taxa do personal shopper)
 * nos pedidos PAGOS dentro da janela de 3 meses do cliente.
 *
 * Se o filtro composto (userId + data + status) não tem índice, cai para
 * fallback em memória — é o mesmo padrão que `customRequestService.getAll`
 * usa quando falta índice composto. Sem um índice a consulta nega-se a rodar;
 * com um índice, a busca é rápida. Aqui prefiro não inventar um novo índice
 * (que viria ao custo de manutenção) e deixar o fallback em memória fazer o
 * trabalho — ordem é milissegundos numa query apenas por userId.
 */
export async function recentProductSpendYen(db, userId) {
  if (!db || !userId) return 0;

  const windowStart = spendWindowStart();
  const userIdStr = String(userId);

  try {
    // Tentar com índice composto: userId + orderDate + paymentConfirmed.
    const snap = await db
      .collection('orders')
      .where('userId', '==', userIdStr)
      .where('orderDate', '>=', windowStart.toISOString())
      .where('paymentConfirmed', '==', true)
      .get();

    return computeProductSpend(snap);
  } catch (error) {
    // Índice composto ausente ou erro transiente. Fallback: filtrar em memória.
    // É seguro porque geralmente há centenas de pedidos por usuário no máximo,
    // e o que importa é o recorte de 3 meses.
    try {
      const snap = await db.collection('orders').where('userId', '==', userIdStr).get();
      const windowStartTime = windowStart.getTime();
      const filtered = snap.docs.filter((doc) => {
        const order = doc.data();
        const orderTime = order.orderDate ? new Date(order.orderDate).getTime() : 0;
        const paid = order.paymentConfirmed === true || order.status === 'confirmed';
        return paid && orderTime >= windowStartTime;
      });
      return computeProductSpend({ docs: filtered });
    } catch {
      // DB indisponível ou algum outro erro permanente.
      return 0;
    }
  }
}

/**
 * Soma o subtotal de mercadoria de um snapshot de pedidos.
 *
 * O pedido não grava `productSubtotalYen` diretamente (esse valor é calculado
 * em `buildQuote` e se transforma em várias colunas específicas — frete,
 * desconto, etc.). A reconstruir é simples: ¥ unitário × quantidade.
 */
function computeProductSpend(snap) {
  let total = 0;
  snap.docs.forEach((doc) => {
    const order = doc.data();
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      // Pula itens gratuitos (brinde ou promoção). Só os que foram pagos.
      if (item.freeGift !== true) {
        const unitYen = Number(item.unitYen) || 0;
        const qty = Number(item.quantity) || 0;
        total += unitYen * qty;
      }
    });
  });
  return Math.max(0, Math.round(total));
}
