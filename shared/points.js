// Pontos de fidelidade — a MESMA conta na tela do checkout e no servidor.
//
// Mora em `shared/` pelo mesmo motivo que `pricing.js`: `src` não pode importar
// de `api/_lib`, e `src/services/pointsService.ts` puxa o Firebase, então o
// servidor também não pode importar de lá. Sem um lugar comum, viram duas
// cópias — e foi exatamente o que aconteceu: a tela prometia 100 pontos e o
// servidor creditava 85 quando havia cupom e pagamento em PIX.

/** 1 ponto a cada ¥100 gastos em produto. */
export const POINTS_PER_100_YEN = 1;

/** Um ponto vale ¥1 de desconto no resgate. */
export const YEN_PER_POINT = 1;

export function pointsForSpendYen(yen) {
  return Math.max(0, Math.floor((Number(yen) || 0) / 100) * POINTS_PER_100_YEN);
}

/**
 * Pontos do pedido.
 *
 * Conta sobre o valor CHEIO dos produtos: cupom e desconto de pagamento não
 * cortam ponto. Quem compra ¥10.000 ganha 100 pontos, tenha usado cupom ou não
 * — é o que a tela sempre prometeu, e é a promessa que a loja escolheu manter.
 *
 * O que sai da base é só o que foi pago COM pontos. Sem isso o resgate se
 * pagaria sozinho: ¥1.000 em pontos viraria ¥1.000 de compra que devolve mais
 * 10 pontos, indefinidamente.
 *
 * Frete e taxa do personal shopper nunca entraram — pontos são sobre mercadoria.
 */
export function earnedPointsForOrder(productSubtotalYen, pointsDiscountYen = 0) {
  const bruto = Math.max(0, Number(productSubtotalYen) || 0);
  const pago = Math.max(0, Number(pointsDiscountYen) || 0);
  return pointsForSpendYen(Math.max(0, bruto - pago));
}
