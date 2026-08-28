const FALLBACK_YEN_PER_UNIT = Object.freeze({
  BRL: 28 / 1.04,
  EUR: 175 / 1.04,
  USD: 150 / 1.04,
});

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function orderEpoch(order) {
  const value = order?.orderDate ?? order?.date ?? order?.syncedAt ?? order?.createdAt;
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value ?? 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function orderDateCursorValue(order) {
  const value = order?.orderDate;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return '';
}

export function toYen(amount, currency) {
  const value = number(amount);
  if (!value) return 0;
  const code = String(currency || 'JPY').toUpperCase();
  const rate = FALLBACK_YEN_PER_UNIT[code];
  return Math.round(rate ? value * rate : value);
}

// Ordem de prioridade: `totalYen` é o campo gravado pelo checkout normal
// (api/orders.js, via `quote.totalYen` de `buildQuote`). `grandTotalYen` só
// existe nos pedidos de "venda posterior" criados manualmente pelo admin
// (src/services/orderService.ts `createManualSale`, sempre em ¥) — mantido
// como fallback para não zerar a receita desses pedidos. `grandTotalYen`
// NUNCA foi gravado pelo checkout normal, então usá-lo como primeira opção
// (como este arquivo fazia antes) zerava a receita de todo pedido normal
// sempre que `totalPrice`/`totalAmount` (em moeda local) não convertiam 1:1
// para ¥ — ou seja, para qualquer pedido fora do Japão.
export function orderRevenueYen(order) {
  return number(order?.totalYen)
    || number(order?.grandTotalYen)
    || toYen(number(order?.totalPrice ?? order?.totalAmount), order?.currency);
}

// `shippingCostYen` (e o espelho `shipping.cost`) já são gravados em ¥ puro
// por `api/orders.js` (`quote.shippingYen`, calculado inteiramente em ¥ por
// `shippingYen()` em `commerce.js`) — nunca precisaram de conversão de
// moeda. O código antigo lia o campo inexistente `shippingCost` (sempre 0)
// e, quando caía no fallback, ainda multiplicava pela razão
// `grandTotalYen / totalPrice` — uma conversão que não fazia sentido para
// um valor que já estava em ¥.
function orderShippingYen(order) {
  return number(order?.shippingCostYen ?? order?.shipping?.cost);
}

// `orders.js` grava `couponDiscountYen` (já em ¥, congelado no checkout) —
// nunca gravou `couponDiscount` (bare). Ler o campo errado fazia este total
// e o relatório de cupons (`couponRow` abaixo) ficarem sempre zerados.
function orderDiscountYen(order) {
  return number(order?.couponDiscountYen);
}

// `redeemPoints` já sai do checkout em ¥ (1 ponto = ¥1 — ver shared/points.js),
// gravado direto no pedido por `orders.js`. Sem conversão de moeda.
function orderPointsYen(order) {
  return number(order?.redeemPoints);
}

function productCostLookup(products) {
  const result = new Map();
  for (const product of products) {
    const cost = number(product?.cost);
    if (product?.id) result.set(String(product.id), cost);
    if (product?.name) result.set(String(product.name), cost);
  }
  return result;
}

function orderCostYen(order, costs) {
  return Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => {
        const snapshotCost = item?.cost;
        const fallback = costs.get(String(item?.productId || ''))
          ?? costs.get(String(item?.productName || item?.name || ''))
          ?? 0;
        return sum + number(snapshotCost ?? fallback) * Math.max(1, number(item?.quantity) || 1);
      }, 0)
    : 0;
}

function monthStartUtc(date, offset = 0) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1);
}

function monthLabel(epoch) {
  return new Date(epoch).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Ciclo real de status do pedido (confirmado lendo `api/orders.js`,
// `api/_lib/fulfillment.js` e `src/services/orderService.ts`):
//   'pending_payment' — criado no checkout, aguardando confirmação do
//                        pagamento (Stripe webhook / PIX-Wise-Yucho manual).
//   'payment_review'  — o cliente foi cobrado mas a separação falhou
//                        (ex.: estoque insuficiente); fica preso esperando
//                        decisão manual/estorno (`refundPending`).
//   'confirmed'        — pagamento confirmado e pedido liberado para
//                        separação. Inclui os sub-estados manuais
//                        'processing'/'packing' que só existem dentro do
//                        fluxo de admin (`src/pages/Admin.tsx`
//                        `handleUpdateStatus`) entre "confirmado" e
//                        "enviado" — nenhum deles é um estado final.
//   'shipped'          — admin marcou como enviado.
//   'delivered'        — cliente confirmou o recebimento, ou admin marcou
//                        manualmente.
//   'cancelled'        — cancelado.
// Nenhum destes literais é o antigo 'pending' solto que este arquivo
// comparava antes (o que zerava `pendingOrders` para sempre); mantido só
// como sinônimo defensivo de 'pending_payment'.
const PENDING_PAYMENT_STATUSES = new Set(['pending_payment', 'pending']);
const PAYMENT_REVIEW_STATUSES = new Set(['payment_review']);
const CONFIRMED_STATUSES = new Set(['confirmed', 'processing', 'packing']);

export function buildDashboardAnalytics(orders, products = [], now = new Date()) {
  const costs = productCostLookup(products);
  const active = orders.filter((order) => order?.status !== 'cancelled');
  const thisMonth = monthStartUtc(now);
  const lastMonth = monthStartUtc(now, -1);
  const nextMonth = monthStartUtc(now, 1);
  const inRange = (order, from, to) => {
    const epoch = orderEpoch(order);
    return epoch >= from && epoch < to;
  };

  let receitaComFrete = 0;
  let receitaSemFrete = 0;
  let receitaPS = 0;
  let custo = 0;
  let descontosCupomYen = 0;
  let pontosResgatadosYen = 0;
  const productCount = new Map();
  const paymentRevenue = new Map();

  for (const order of active) {
    const revenue = orderRevenueYen(order);
    const withoutShipping = Math.max(revenue - orderShippingYen(order), 0);
    receitaComFrete += revenue;
    receitaSemFrete += withoutShipping;
    receitaPS += number(order?.psFeeYen);
    custo += orderCostYen(order, costs);
    descontosCupomYen += orderDiscountYen(order);
    pontosResgatadosYen += orderPointsYen(order);

    for (const item of Array.isArray(order?.items) ? order.items : []) {
      const name = String(item?.productName || item?.name || 'Produto');
      productCount.set(name, (productCount.get(name) || 0) + Math.max(1, number(item?.quantity) || 1));
    }

    const method = order?.paymentMethod === 'paypay' ? 'PayPay'
      : order?.paymentMethod === 'pix' ? 'PIX'
      : order?.paymentMethod === 'wise' ? 'Wise'
      : order?.paymentMethod === 'yucho' ? 'Yucho'
      : order?.paymentMethod === 'card' ? 'Cartão'
      : 'Outro';
    paymentRevenue.set(method, (paymentRevenue.get(method) || 0) + revenue);
  }

  const receitaProduto = Math.max(receitaSemFrete - receitaPS, 0);
  const monthlyData = [];
  for (let offset = -5; offset <= 0; offset += 1) {
    const start = monthStartUtc(now, offset);
    const end = monthStartUtc(now, offset + 1);
    const monthOrders = active.filter((order) => inRange(order, start, end));
    const withShipping = monthOrders.reduce((sum, order) => sum + orderRevenueYen(order), 0);
    const withoutShipping = monthOrders.reduce(
      (sum, order) => sum + Math.max(orderRevenueYen(order) - orderShippingYen(order), 0),
      0,
    );
    const monthCost = monthOrders.reduce((sum, order) => sum + orderCostYen(order, costs), 0);
    monthlyData.push({
      month: monthLabel(start),
      orders: monthOrders.length,
      receitaComFrete: withShipping,
      receitaSemFrete: withoutShipping,
      custo: monthCost,
      lucro: withoutShipping - monthCost,
    });
  }

  const revenueThisMonth = active
    .filter((order) => inRange(order, thisMonth, nextMonth))
    .reduce((sum, order) => sum + orderRevenueYen(order), 0);
  const revenueLastMonth = active
    .filter((order) => inRange(order, lastMonth, thisMonth))
    .reduce((sum, order) => sum + orderRevenueYen(order), 0);

  return {
    stats: {
      totalOrders: active.length,
      pendingOrders: orders.filter((order) => PENDING_PAYMENT_STATUSES.has(order?.status)).length,
      paymentReviewOrders: orders.filter((order) => PAYMENT_REVIEW_STATUSES.has(order?.status)).length,
      confirmedOrders: orders.filter((order) => CONFIRMED_STATUSES.has(order?.status)).length,
      shippedOrders: orders.filter((order) => order?.status === 'shipped').length,
      deliveredOrders: orders.filter((order) => order?.status === 'delivered').length,
      cancelledOrders: orders.filter((order) => order?.status === 'cancelled').length,
      totalRevenue: receitaComFrete,
      revenueThisMonth,
      revenueLastMonth,
      ordersThisMonth: active.filter((order) => inRange(order, thisMonth, nextMonth)).length,
      ordersLastMonth: active.filter((order) => inRange(order, lastMonth, thisMonth)).length,
    },
    finance: {
      receitaComFrete,
      receitaSemFrete,
      receitaProduto,
      receitaPS,
      custo,
      lucro: receitaProduto - custo,
      descontosCupomYen,
      pontosResgatadosYen,
    },
    monthlyData,
    topProducts: [...productCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    paymentMethods: [...paymentRevenue.entries()].map(([method, revenue]) => ({ method, revenue })),
  };
}

export function couponRow(order) {
  const couponDiscount = number(order?.couponDiscountYen);
  const couponCode = String(order?.couponCode || '');
  const affiliateCode = String(order?.affiliateCode || '');
  const epoch = orderEpoch(order);
  if (order?.status === 'cancelled' || (!couponDiscount && !couponCode && !affiliateCode)) return null;
  return {
    id: String(order?.id || order?.orderNumber || ''),
    orderNumber: String(order?.orderNumber || order?.id || ''),
    orderDate: epoch ? new Date(epoch).toISOString() : '',
    customerEmail: String(order?.customerEmail || ''),
    couponCode,
    couponDiscount,
    currency: String(order?.currency || 'BRL'),
    discountYen: orderDiscountYen(order),
    grandTotalYen: orderRevenueYen(order),
    isAffiliate: Boolean(affiliateCode),
    affiliateCode,
  };
}

export function matchesCouponFilters(row, type = 'all', code = '') {
  if (!row) return false;
  if (type === 'coupon' && row.isAffiliate) return false;
  if (type === 'affiliate' && !row.isAffiliate) return false;
  const needle = String(code).trim().toLowerCase();
  return !needle
    || row.couponCode.toLowerCase().includes(needle)
    || row.affiliateCode.toLowerCase().includes(needle);
}
