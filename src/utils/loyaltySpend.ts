import { spendWindowStart } from '../../shared/points.js';

// Gasto em mercadoria na janela de níveis de pontos, a partir do histórico que
// o cliente já tem carregado.
//
// Mesmo critério de `api/_lib/loyalty-tier.js`: só pedido pago, só mercadoria,
// sempre em ienes. A conta vive aqui, e não copiada dentro de cada tela, porque
// a revisão do pedido e o perfil precisam prometer o MESMO nível — foi
// exatamente esse tipo de cópia que já fez a tela dizer 100 pontos e o servidor
// creditar 85.

/** Só o que o cálculo precisa: qualquer pedido do app satisfaz por estrutura. */
interface SpendOrder {
  orderDate?: string;
  date?: string;
  status?: string;
  paymentConfirmed?: boolean;
  items?: Array<{ unitYen?: number; quantity?: number; freeGift?: boolean }>;
}

/**
 * Pedido sem `unitYen` (histórico local antigo) conta ZERO em vez de cair para
 * `price`: `price` está na moeda do cliente, e somar BRL com ¥ inflaria o
 * nível. Subestimar só mostra um nível menor do que o servidor vai creditar —
 * errar para menos é o lado seguro de uma promessa na tela.
 */
export function recentProductSpendYen(orders: SpendOrder[] | undefined | null, now = new Date()): number {
  if (!orders?.length) return 0;
  const inicioJanela = spendWindowStart(now).getTime();
  let total = 0;
  for (const order of orders) {
    const pago = order.status === 'confirmed' || order.paymentConfirmed === true;
    if (!pago) continue;
    // `date` é pt-BR (dd/mm/aaaa) e não é parseável de forma confiável; quando
    // só ele existe, o pedido entra na janela em vez de ser descartado — quem
    // comprou não pode perder nível por causa do formato da data.
    const quando = order.orderDate ? new Date(order.orderDate).getTime() : NaN;
    if (Number.isFinite(quando) && quando < inicioJanela) continue;
    if (!Array.isArray(order.items)) continue;
    for (const item of order.items) {
      if (item.freeGift === true) continue;
      total += (Number(item.unitYen) || 0) * (Number(item.quantity) || 0);
    }
  }
  return Math.max(0, Math.round(total));
}
