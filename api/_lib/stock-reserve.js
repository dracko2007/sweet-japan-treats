/**
 * Reserva temporária de estoque comum entre criar o pedido e confirmar o
 * pagamento — mesmo problema e mesma solução de `promo-reserve.js` (ver o
 * cabeçalho de lá para o raciocínio completo), agora para o estoque de
 * QUALQUER produto, não só a promoção da home.
 *
 * O problema: dois checkouts simultâneos na última unidade de um produto
 * comum — um paga com cartão (resolve em segundos via webhook do Stripe),
 * outro escolhe PIX/Wise/depósito (só confirmado à mão pelo admin, às vezes
 * horas depois) — hoje os dois passam pela checagem de estoque em
 * `orders.js` (que só lê `stock.quantity`, sem descontar pedidos concorrentes
 * ainda não pagos). Os dois recebem confirmação de pedido. Quando o segundo
 * (o PIX) finalmente é confirmado, `fulfillOrder` recusa com
 * `insufficient_stock` — depois do cliente já ter pago e recebido instrução
 * de pagamento. Isso NÃO é overselling: a trava atômica de `fulfillOrder`
 * (ver `api/_lib/fulfillment.js`) continua sendo a fonte de verdade e nunca
 * decrementa estoque abaixo de zero. É uma promessa quebrada ao cliente que
 * pagou por último, e um estorno manual chato para a loja.
 *
 * Um documento por produto (`stock_reserve/{productId}`), não um documento
 * global único: pedidos de produtos diferentes não precisam serializar entre
 * si, só os que disputam o MESMO produto.
 *
 * Mesmas três decisões de `promo-reserve.js`: (1) coleção separada, negada
 * nas regras a todo mundo — só o Admin SDK chega nela; (2) toda reserva tem
 * prazo (não existe endpoint de cancelamento de pedido no servidor: sem
 * prazo, um checkout abandonado seguraria a unidade para sempre — reserva
 * vencida é ignorada na conta e podada na escrita seguinte); (3) a reserva é
 * liberada explicitamente quando o pedido termina (pago, em `fulfillOrder`,
 * ou morto em `payment_review`, em `markFulfillmentReview`), sem esperar o
 * prazo, para o estoque voltar a ficar disponível o quanto antes.
 */
import { prazoReserva } from './promo-reserve.js';

export { prazoReserva };

export function refReservaEstoque(db, productId) {
  return db.collection('stock_reserve').doc(productId);
}

function lista(estado) {
  return Array.isArray(estado?.holds) ? estado.holds : [];
}

function vigentes(estado, agora) {
  return lista(estado).filter((hold) => hold && Number(hold.quantity) > 0 && Number(hold.expiresAt || 0) > agora);
}

/**
 * Unidades seguradas por OUTROS pedidos ainda em aberto para este produto.
 * `orderId` exclui a própria reserva do pedido (retentativa da criação não
 * pode competir consigo mesma).
 */
export function quantidadeReservadaEstoque(estado, orderId, agora = Date.now()) {
  const total = vigentes(estado, agora)
    .filter((hold) => hold.orderId !== orderId)
    .reduce((soma, hold) => soma + Math.floor(Number(hold.quantity || 0)), 0);
  return Math.max(0, total);
}

/**
 * Estado com a reserva do pedido adicionada e as vencidas podadas. Regravar
 * o mesmo `orderId` substitui a reserva anterior — retentativa de criação não
 * soma duas vezes.
 */
export function comReservaEstoque(estado, { orderId, quantity, paymentMethod }, agora = Date.now()) {
  const outras = vigentes(estado, agora).filter((hold) => hold.orderId !== orderId);
  const unidades = Math.max(0, Math.floor(Number(quantity || 0)));
  const holds = unidades === 0
    ? outras
    : [...outras, { orderId, quantity: unidades, expiresAt: agora + prazoReserva(paymentMethod) }];
  return { holds };
}

/**
 * Estado sem a reserva do pedido. Usado quando o pedido chega ao fim — pago
 * (o estoque já desce na mesma transação e a reserva viraria contagem
 * dobrada) ou morto em `payment_review`.
 */
export function semReservaEstoque(estado, orderId, agora = Date.now()) {
  return { holds: vigentes(estado, agora).filter((hold) => hold.orderId !== orderId) };
}
