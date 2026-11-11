// Estoque local: produto que JÁ ESTÁ no país do cliente (com empresa parceira).
//
// O mesmo cadastro do produto guarda, por país, um preço fixo na moeda de lá e
// a quantidade disponível:
//   product.localStock = { Brasil: { enabled: true, price: 89, quantity: 12, shipping: 25 } }
//
// Pedido "local" = só itens com estoque local: cobra o preço fixo (sem câmbio,
// sem taxa de Personal Shopper, sem imposto de importação) e o frete nacional
// cadastrado no próprio produto (`shipping`, na moeda do país). Acabou o estoque local, o produto volta a ser vendido do Japão.
//
// Mora em `shared/` porque a vitrine, o carrinho e o servidor precisam chegar
// na MESMA resposta sobre "este produto está no país do cliente?".

import { rateCushion } from './money.js';

/**
 * Preço local → ¥ equivalente. NÃO é cobrado: serve de base em ¥ para cupom
 * fixo, pontos, comissão e relatórios. Servidor e navegador usam esta mesma
 * conta, senão o total da tela e o cobrado divergem.
 */
export function localUnitYen(amount, currency, rates) {
  if (currency === 'JPY') return Math.round(amount);
  const rate = Number(rates?.[currency]);
  if (!(rate > 0)) return 0;
  return Math.round(amount / (rate * (1 + rateCushion(rates))));
}

/**
 * Oferta local de um produto para um país, ou null.
 * Só vale com preço, unidades E frete preenchidos (frete 0 = grátis): produto
 * sem frete cadastrado segue vendido só do Japão, nunca sai de graça por engano.
 */
export function localOffer(product, country) {
  const entry = product?.localStock?.[country];
  if (!entry || entry.enabled !== true) return null;
  const price = Math.round(Number(entry.price));
  const quantity = Math.floor(Number(entry.quantity));
  if (!(price > 0) || !(quantity > 0)) return null;
  if (entry.shipping === undefined || entry.shipping === null || entry.shipping === '') return null;
  const shipping = Math.round(Number(entry.shipping));
  if (!Number.isFinite(shipping) || shipping < 0) return null;
  return { price, quantity, shipping };
}

/**
 * Frete nacional de um pedido local, na moeda do país: os itens seguem num
 * pacote só, então vale o MAIOR frete entre os produtos (não a soma).
 */
export function localOrderShipping(offers) {
  return offers.reduce((max, offer) => Math.max(max, Number(offer?.shipping) || 0), 0);
}

/** Nome do frete nacional mostrado ao cliente. */
export function localCarrierLabel(country) {
  return country === 'Brasil' ? 'PAC (Correios)' : 'Envio nacional';
}
