// Estoque local: produto que JÁ ESTÁ no país do cliente (com empresa parceira).
//
// O mesmo cadastro do produto guarda, por país, um preço fixo na moeda de lá e
// a quantidade disponível:
//   product.localStock = { Brasil: { enabled: true, price: 89, quantity: 12, shippingOptions: [{ name: 'Sul', price: 29 }] } }
//
// Pedido "local" = só itens com estoque local: cobra o preço fixo (sem câmbio,
// sem taxa de Personal Shopper, sem imposto de importação) e o frete nacional
// cadastrado no próprio produto (`shippingOptions`: nome + valor, na moeda do país). Acabou o estoque local, o produto volta a ser vendido do Japão.
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

export const BR_REGIONS = {
  sul: ['PR', 'RS', 'SC'],
  sudeste: ['ES', 'MG', 'RJ', 'SP'],
  centroOeste: ['DF', 'GO', 'MS', 'MT'],
  nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  norte: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
};
export const BR_REGION_LABELS = { sul: 'Sul', sudeste: 'Sudeste', centroOeste: 'Centro-Oeste', nordeste: 'Nordeste', norte: 'Norte' };

const BR_STATE_NAMES = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

/** Região do Brasil a partir da UF ("SP") ou do nome do estado ("São Paulo"). */
export function brRegion(state) {
  const text = String(state || '').trim();
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const uf = text.length === 2 ? text.toUpperCase() : BR_STATE_NAMES[plain] || '';
  for (const [region, states] of Object.entries(BR_REGIONS)) if (states.includes(uf)) return region;
  return '';
}

// "Centro-Oeste", "centro oeste" e "CENTRO OESTE" são o mesmo nome de frete.
const normName = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Opções de frete nacional cadastradas no produto, para um país:
 *   [{ name: 'Sul', price: 29 }, { name: 'Sudeste', price: 22 }]
 * (moeda do país; preço 0 = grátis). Linhas sem nome ou sem preço são ignoradas.
 * Produto antigo, com um frete único em `shipping`, vira uma opção só.
 */
export function shippingOptionsOf(entry) {
  const raw = Array.isArray(entry?.shippingOptions)
    ? entry.shippingOptions
    : (entry?.shipping === undefined || entry?.shipping === null ? [] : [{ name: 'Frete', price: entry.shipping }]);
  const seen = new Set();
  const out = [];
  for (const option of raw) {
    const name = String(option?.name || '').trim().slice(0, 40);
    if (!name || seen.has(normName(name))) continue;
    if (option?.price === undefined || option?.price === null || option?.price === '') continue;
    const price = Math.round(Number(option.price));
    if (!Number.isFinite(price) || price < 0) continue;
    seen.add(normName(name));
    out.push({ name, price });
  }
  return out;
}

/**
 * Oferta local de um produto para um país, ou null.
 * Só vale com preço, unidades E ao menos um frete preenchido (frete 0 = grátis):
 * produto sem frete cadastrado segue vendido só do Japão, nunca sai de graça por engano.
 */
export function localOffer(product, country) {
  const entry = product?.localStock?.[country];
  if (!entry || entry.enabled !== true) return null;
  const price = Math.round(Number(entry.price));
  const quantity = Math.floor(Number(entry.quantity));
  if (!(price > 0) || !(quantity > 0)) return null;
  const shippingOptions = shippingOptionsOf(entry);
  if (shippingOptions.length === 0) return null;
  return { price, quantity, shippingOptions };
}

/**
 * Frete de UM produto para este cliente: a opção que ele escolheu (`choice`);
 * no Brasil, a da região dele (opção chamada Sul, Sudeste…); ou a única que existe.
 * Null = ainda não dá para saber (o cliente precisa escolher).
 */
export function pickShippingOption(offer, { country, state, choice } = {}) {
  const options = offer?.shippingOptions || [];
  if (choice) {
    const chosen = options.find((option) => normName(option.name) === normName(choice));
    if (chosen) return chosen;
  }
  if (country === 'Brasil') {
    const region = brRegion(state);
    const byRegion = region && options.find((option) => normName(option.name) === normName(BR_REGION_LABELS[region]));
    if (byRegion) return byRegion;
  }
  return options.length === 1 ? options[0] : null;
}

/**
 * Frete do pedido local: os itens seguem num pacote só, então vale o MAIOR frete
 * entre os produtos (não a soma). Null se algum produto ainda não tem frete definido.
 */
export function localOrderShipping(offers, context) {
  let best = null;
  for (const offer of offers) {
    const picked = pickShippingOption(offer, context);
    if (!picked) return null;
    if (!best || picked.price > best.price) best = picked;
  }
  return best;
}

/** Nomes de frete que o cliente pode escolher num pedido (união das opções dos produtos). */
export function shippingChoiceNames(offers) {
  const seen = new Map();
  for (const offer of offers) for (const option of offer?.shippingOptions || []) if (!seen.has(normName(option.name))) seen.set(normName(option.name), option.name);
  return [...seen.values()];
}

/** Nome do frete nacional mostrado ao cliente. */
export function localCarrierLabel(country) {
  return country === 'Brasil' ? 'PAC (Correios)' : 'Envio nacional';
}
