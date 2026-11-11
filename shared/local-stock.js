// Estoque local: produto que JÁ ESTÁ no país do cliente (com empresa parceira).
//
// O mesmo cadastro do produto guarda, por país, um preço fixo na moeda de lá e
// a quantidade disponível:
//   product.localStock = { Brasil: { enabled: true, price: 89, quantity: 12 } }
//
// Pedido "local" = só itens com estoque local: cobra o preço fixo (sem câmbio,
// sem taxa de Personal Shopper, sem imposto de importação) e frete nacional de
// tabela. Acabou o estoque local, o produto volta a ser vendido do Japão.
//
// Mora em `shared/` porque a vitrine, o carrinho e o servidor precisam chegar
// na MESMA resposta sobre "este produto está no país do cliente?".

/** Oferta local de um produto para um país, ou null. */
export function localOffer(product, country) {
  const entry = product?.localStock?.[country];
  if (!entry || entry.enabled !== true) return null;
  const price = Math.round(Number(entry.price));
  const quantity = Math.floor(Number(entry.quantity));
  if (!(price > 0) || !(quantity > 0)) return null;
  return { price, quantity };
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

/**
 * Frete nacional de tabela, na moeda do país, ou null se não está configurado.
 * `table` é o documento `siteContent/localShipping`:
 *   { Brasil: { regions: { sul: 25, sudeste: 22, ... } }, Portugal: { flat: 6 } }
 */
export function localShippingAmount(table, country, state) {
  const config = table?.[country];
  if (!config) return null;
  const raw = country === 'Brasil' ? config.regions?.[brRegion(state)] : config.flat;
  if (raw === undefined || raw === null || raw === '') return null;
  const amount = Math.round(Number(raw));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Nome do frete nacional mostrado ao cliente. */
export function localCarrierLabel(country) {
  return country === 'Brasil' ? 'PAC (Correios)' : 'Envio nacional';
}
