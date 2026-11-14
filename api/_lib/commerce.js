import { earnedPointsForOrder, pointsMultiplierForSpend } from '../../shared/points.js';
import { packedWeightG, parcelWeightG, productPackedWeightG } from '../../shared/weight.js';
import { yupackRateYen } from '../../shared/yupack.js';
import { roundYen } from '../../shared/pricing.js';
import {
  autoApprovablePsDiscountYen,
  displayTotals,
  yenToDisplay,
  productBenefits,
  psFeeDiscountYen,
  soloFreeShipping,
  US_COUNTRY,
} from '../../shared/money.js';
import { localOffer, localOrderShipping, localUnitYen } from '../../shared/local-stock.js';
import { HttpError } from './http.js';
import { currencyForCountry } from './fx.js';

const E_LIGHT = {
  1: [720,820,920,1020,1120,1220,1320,1420,1520,1620,1720,1820,1920,2020,2120,2220,2320,2420,2520,2620],
  2: [750,870,990,1110,1230,1350,1470,1590,1710,1830,1950,2070,2190,2310,2430,2550,2670,2790,2910,3030],
  3: [880,1060,1240,1420,1600,1780,1960,2140,2320,2500,2680,2860,3040,3220,3400,3580,3760,3940,4120,4300],
  4: [1200,1410,1620,1830,2040,2250,2460,2670,2880,3090,3300,3510,3720,3930,4140,4350,4560,4770,4980,5190],
  5: [920,1180,1440,1700,1960,2220,2480,2740,3000,3260,3520,3780,4040,4300,4560,4820,5080,5340,5600,5860],
};
const AIR_PARCEL = {
  1: [2050,2750,3450,4150,4850,5550,6250,6950,7650,8350,8850,9350,9850,10350,10850,11350,11850,12350,12850,13350,13850,14350,14850,15350,15850,16350,16850,17350,17850,18350],
  2: [2500,3700,4900,6100,7300,8500,9700,10900,12100,13300,13950,14600,15250,15900,16550,17200,17850,18500,19150,19800,20450,21100,21750,22400,23050,23700,24350,25000,25650,26300],
  3: [3850,6000,8150,10300,12450,14600,16750,18900,21050,23200,24800,26400,28000,29600,31200,32800,34400,36000,37600,39200,40800,42400,44000,45600,47200,48800,50400,52000,53600,55200],
  4: [4200,6700,9200,11700,14200,16700,19200,21700,24200,26700,28700,30700,32700,34700,36700,38700,40700,42700,44700,46700,48700,50700,52700,54700,56700,58700,60700,62700,64700,66700],
  5: [4550,7250,9950,12650,15350,18050,20750,23450,26150,28850,30650,32450,34250,36050,37850,39650,41450,43250,45050,46850,48650,50450,52250,54050,55850,57650,59450,61250,63050,64850],
};
const EMS_BRACKETS = [500,600,700,800,900,1000,1250,1500,1750,2000,2500,3000,3500,4000,4500,5000,5500,6000,7000,8000,9000,10000,11000,12000,13000,14000,15000,16000,17000,18000,19000,20000,21000,22000,23000,24000,25000,26000,27000,28000,29000,30000];
const EMS = {
  1: [1450,1600,1750,1900,2050,2200,2500,2800,3100,3400,3900,4400,4900,5400,5900,6400,6900,7400,8200,9000,9800,10600,11400,12200,13000,13800,14600,15400,16200,17000,17800,18600,19400,20200,21000,21800,22600,23400,24200,25000,25800,26600],
  2: [1900,2150,2400,2650,2900,3150,3500,3850,4200,4550,5150,5750,6350,6950,7550,8150,8750,9350,10350,11350,12350,13350,14350,15350,16350,17350,18350,19350,20350,21350,22350,23350,24350,25350,26350,27350,28350,29350,30350,31350,32350,33350],
  3: [3150,3400,3650,3900,4150,4400,5000,5550,6150,6700,7750,8800,9850,10900,11950,13000,14050,15100,17200,19300,21400,23500,25600,27700,29800,31900,34000,36100,38200,40300,42400,44500,46600,48700,50800,52900,55000,57100,59200,61300,63400,65500],
  4: [3900,4180,4460,4740,5020,5300,5990,6600,7290,7900,9100,10300,11500,12700,13900,15100,16300,17500,19900,22300,24700,27100,29500,31900,34300,36700,39100,41500,43900,46300,48700,51100,53500,55900,58300,60700,63100,65500,67900,70300,72700,75100],
  5: [3600,3900,4200,4500,4800,5100,5850,6600,7350,8100,9600,11100,12600,14100,15600,17100,18600,20100,22500,24900,27300,29700,32100,34500,36900,39300,41700,44100,46500,48900,51300,53700,56100,58500,60900,63300,65700,68100,70500,72900,75300,77700],
};
const DOMESTIC_RATES = {
  yuubin: { 60: { 1: 870, 2: 970, 3: 1100, 4: 1350 }, 80: { 1: 1100, 2: 1200, 3: 1400, 4: 1700 } },
  yamato: { 60: { 1: 930, 2: 1040, 3: 1150, 4: 1480 }, 80: { 1: 1150, 2: 1260, 3: 1370, 4: 1810 } },
  sagawa: { 60: { 1: 880, 2: 990, 3: 1100, 4: 1430 }, 80: { 1: 1100, 2: 1210, 3: 1430, 4: 1760 } },
};
const DOMESTIC_ZONE = new Map([
  ...['Hiroshima','Okayama','Yamaguchi','Tottori','Shimane','Ehime'].map((name) => [name, 1]),
  ...['Kagawa','Tokushima','Kochi','Hyogo','Osaka','Kyoto','Nara','Shiga','Wakayama','Fukuoka','Saga','Nagasaki','Kumamoto','Oita'].map((name) => [name, 2]),
  ...['Miyazaki','Kagoshima','Mie','Aichi','Gifu','Shizuoka','Nagano','Fukui','Ishikawa','Toyama','Niigata','Yamanashi','Tokyo','Kanagawa','Saitama','Chiba','Ibaraki','Tochigi','Gunma'].map((name) => [name, 3]),
  ...['Miyagi','Fukushima','Yamagata','Iwate','Akita','Aomori','Hokkaido','Okinawa'].map((name) => [name, 4]),
]);
const COUNTRY_CONFIG = new Map([
  ['Brasil', { currency: 'BRL', zone: 5, vat: .17 }],
  ['Japão', { currency: 'JPY', zone: 1, vat: 0 }],
  ['Portugal', { currency: 'EUR', zone: 3, vat: .23 }],
  ['França', { currency: 'EUR', zone: 3, vat: .20 }],
  ['Itália', { currency: 'EUR', zone: 3, vat: .22 }],
  ['Espanha', { currency: 'EUR', zone: 3, vat: .21 }],
  ['Estados Unidos', { currency: 'USD', zone: 4, vat: 0 }],
  ['Canadá', { currency: 'USD', zone: 3, vat: .13 }],
  ['México', { currency: 'USD', zone: 3, vat: .16 }],
  ['Argentina', { currency: 'USD', zone: 5, vat: .21 }],
  ['Chile', { currency: 'USD', zone: 5, vat: .19 }],
  ['Colômbia', { currency: 'USD', zone: 5, vat: .19 }],
  ['Peru', { currency: 'USD', zone: 5, vat: .18 }],
  ['Uruguai', { currency: 'USD', zone: 5, vat: .22 }],
  ['Reino Unido', { currency: 'USD', zone: 3, vat: .20 }],
  ['Alemanha', { currency: 'EUR', zone: 3, vat: .19 }],
  ['Países Baixos', { currency: 'EUR', zone: 3, vat: .21 }],
  ['Bélgica', { currency: 'EUR', zone: 3, vat: .21 }],
  ['Suíça', { currency: 'USD', zone: 3, vat: .077 }],
  ['Suécia', { currency: 'USD', zone: 3, vat: .25 }],
  ['Noruega', { currency: 'USD', zone: 3, vat: .25 }],
  ['Irlanda', { currency: 'EUR', zone: 3, vat: .23 }],
  ['Áustria', { currency: 'EUR', zone: 3, vat: .20 }],
  ['Polônia', { currency: 'USD', zone: 3, vat: .23 }],
  ['China', { currency: 'USD', zone: 1, vat: .13 }],
  ['Coreia do Sul', { currency: 'USD', zone: 1, vat: .10 }],
  ['Taiwan', { currency: 'USD', zone: 1, vat: .05 }],
  ['Cingapura', { currency: 'USD', zone: 2, vat: .09 }],
  ['Tailândia', { currency: 'USD', zone: 2, vat: .07 }],
  ['Malásia', { currency: 'USD', zone: 2, vat: .10 }],
  ['Filipinas', { currency: 'USD', zone: 2, vat: .12 }],
  ['Indonésia', { currency: 'USD', zone: 2, vat: .11 }],
  ['Vietnã', { currency: 'USD', zone: 2, vat: .10 }],
  ['Índia', { currency: 'USD', zone: 2, vat: .18 }],
  ['Hong Kong', { currency: 'USD', zone: 2, vat: 0 }],
  ['Austrália', { currency: 'USD', zone: 3, vat: .10 }],
  ['Nova Zelândia', { currency: 'USD', zone: 3, vat: .15 }],
  ['Emirados Árabes', { currency: 'USD', zone: 3, vat: .05 }],
  ['Israel', { currency: 'USD', zone: 3, vat: .17 }],
  ['Arábia Saudita', { currency: 'USD', zone: 3, vat: .15 }],
  ['Turquia', { currency: 'USD', zone: 3, vat: .20 }],
  ['África do Sul', { currency: 'USD', zone: 5, vat: .15 }],
  ['Angola', { currency: 'USD', zone: 5, vat: .14 }],
  ['Moçambique', { currency: 'USD', zone: 5, vat: .16 }],
]);

export { roundYen };

function baseYen(product, variantId) {
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants
    : [
        product.prices?.small ? { id: 'small', price: product.prices.small } : null,
        product.prices?.large ? { id: 'large', price: product.prices.large } : null,
      ].filter(Boolean);
  const variant = variants.find((entry) => entry.id === variantId);
  if (!variant || !(Number(variant.price) > 0)) throw new HttpError(400, 'invalid_variant');
  return roundYen(variant.price);
}

// Nome da opção como a loja mostra ("Kit 3 unidades"; nos antigos, Pequeno/Grande).
// Vazio quando o produto só tem uma opção: não há o que distinguir.
function variantLabel(product, variantId) {
  if (Array.isArray(product.variants) && product.variants.length) {
    if (product.variants.length < 2) return '';
    return String(product.variants.find((entry) => entry.id === variantId)?.label || '');
  }
  if (!(product.prices?.small && product.prices?.large)) return '';
  return variantId === 'small' ? 'Pequeno' : variantId === 'large' ? 'Grande' : '';
}

function discountedYen(product, variantId, campaign) {
  const base = baseYen(product, variantId);
  const productDiscount = Number(product.discountPercent || 0);
  let percent = productDiscount > 0 && productDiscount < 100 ? productDiscount : 0;
  if (campaign?.mechanic === 'discount') {
    percent = campaign.keepProductDiscount ? Math.min(90, percent + Number(campaign.discountPct || 0)) : Number(campaign.discountPct || 0);
  } else if (campaign && !campaign.keepProductDiscount) {
    percent = 0;
  }
  return percent > 0 ? roundYen(base * (1 - percent / 100)) : base;
}

function dimensions(product) {
  const raw = product.packageDimensionsCm;
  if (!raw) return null;
  const values = [Number(raw.widthCm), Number(raw.lengthCm), Number(raw.heightCm)];
  if (!values.every((value) => Number.isFinite(value) && value > 0 && value <= 80)) return null;
  if (values.reduce((sum, value) => sum + value, 0) + 15 > 145) return null;
  return values;
}

function shippingShape(items) {
  let totalWeightG = 0;
  let knownQuantity = 0;
  let missingEquivalent = 0;
  let volume = 0;
  let maxSum = 0;
  for (const item of items) {
    const dims = dimensions(item.product);
    const weight = productPackedWeightG(item.product);
    if (weight > 0) totalWeightG += weight * item.quantity;
    else {
      const estimatedWeight = dims
        ? dims[0] * dims[1] * dims[2] * 0.25
        : item.variantId === 'small' ? 300 : 600;
      totalWeightG += packedWeightG(estimatedWeight) * item.quantity;
    }
    if (!dims) {
      missingEquivalent += (item.variantId === 'small' ? 1 : 2) * item.quantity;
      continue;
    }
    knownQuantity += item.quantity;
    const padded = dims.map((value) => value + 5);
    maxSum = Math.max(maxSum, padded.reduce((sum, value) => sum + value, 0));
    volume += padded.reduce((product, value) => product * value, 1) * item.quantity;
  }
  // Mais a caixa com plástico-bolha, uma vez por pacote (igual ao carrinho).
  totalWeightG = Math.max(100, parcelWeightG(totalWeightG));
  let boxes60 = 0;
  let boxes80 = 0;
  if (knownQuantity === 0) {
    if (missingEquivalent <= 4) boxes60 = 1;
    else if (missingEquivalent <= 6) boxes80 = 1;
    else if (missingEquivalent <= 8) boxes60 = 2;
    else {
      boxes80 = Math.floor(missingEquivalent / 6);
      boxes60 = missingEquivalent % 6 ? Math.ceil((missingEquivalent % 6) / 4) : 0;
    }
  } else {
    if (missingEquivalent) {
      volume += (8000 / 4) * missingEquivalent;
      maxSum = Math.max(maxSum, 60);
    }
    if (maxSum <= 60) boxes60 = Math.max(1, Math.ceil(volume / 8000));
    else boxes80 = Math.max(1, Math.ceil(volume / (Math.pow(80 / 3, 3))));
  }
  return { totalWeightG, boxes60, boxes80, maxSum };
}

/** Tarifa EMS (¥) para o peso já embalado. `null` acima de 30 kg. */
export function emsRateYen(weightG, zone) {
  const index = EMS_BRACKETS.findIndex((bracket) => weightG <= bracket);
  return index >= 0 ? (EMS[zone]?.[index] ?? null) : null;
}

function internationalZone(country) {
  const config = COUNTRY_CONFIG.get(country);
  if (!config) throw new HttpError(400, 'unsupported_country');
  return config.zone;
}

function shippingYen(items, country, prefecture, carrier, productSubtotalYen, freeShipping) {
  const shape = shippingShape(items);
  if (shape.totalWeightG > 30000 || shape.maxSum > 150) throw new HttpError(409, 'shipping_unavailable');
  if (freeShipping) return { amount: 0, weightG: shape.totalWeightG };
  if (country === 'Japão') {
    if (productSubtotalYen >= 6000) return { amount: 0, weightG: shape.totalWeightG };
    const zone = DOMESTIC_ZONE.get(prefecture);
    const rates = DOMESTIC_RATES[carrier];
    if (!zone || !rates) throw new HttpError(400, 'invalid_shipping');
    const rate = (size) => (carrier === 'yuubin' ? yupackRateYen(prefecture, size) : rates[size][zone]);
    const amount = (rate(60) * shape.boxes60) + (rate(80) * shape.boxes80) || rate(60);
    return { amount, weightG: shape.totalWeightG };
  }
  const zone = internationalZone(country);
  // EUA: mercadoria só sai com imposto pré-pago (DDP), e o único serviço com
  // DDP confirmado para lojas é o EMS. Air Packet e Kozutsumi ficam de fora.
  if (country === US_COUNTRY && carrier !== 'ems') throw new HttpError(409, 'shipping_unavailable');
  let amount = null;
  if (carrier === 'eraito' && shape.totalWeightG <= 2000) amount = E_LIGHT[zone][Math.ceil(shape.totalWeightG / 100) - 1];
  if (carrier === 'kozutsumi-air' && shape.totalWeightG > 2000) amount = AIR_PARCEL[zone][Math.ceil(shape.totalWeightG / 1000) - 1];
  if (carrier === 'ems') amount = emsRateYen(shape.totalWeightG, zone);
  if (!(amount > 0)) throw new HttpError(400, 'invalid_shipping');
  return { amount, weightG: shape.totalWeightG };
}

// Estimativa de tributo do destino, só informativa (não entra no total).
// Brasil: a tela não mostra estimativa (`src/utils/taxRules.ts`), porque a
// regra depende do regime da Receita; o pedido gravava uma mesmo assim, e a
// confirmação exibia um número que o checkout nunca mostrou.
// EUA: o imposto agora é pré-pago (DDP) e cobrado como linha própria
// (`display.importDuty`), então não existe estimativa a mostrar.
function informativeTax(amount, country) {
  if (country === 'Japão' || country === 'Brasil' || country === US_COUNTRY) return 0;
  const config = COUNTRY_CONFIG.get(country);
  if (!config) throw new HttpError(400, 'unsupported_country');
  return Math.round(amount * config.vat * 100) / 100;
}


/** Moeda local → ¥ equivalente, só para registro (comissão, pontos, relatórios). Não é cobrado. */
function displayToYen(amount, currency, rates) {
  if (currency !== 'JPY' && !(Number(rates?.[currency]) > 0)) throw new HttpError(503, 'fx_unavailable');
  return localUnitYen(amount, currency, rates);
}

export function buildQuote({ requestedItems, products, country, prefecture, state, carrier, paymentMethod, coupon, redeemPoints, negotiation, campaign, homePromotion, rates, recentSpendYen = 0, psFeeWaived = false, fulfillment = 'japan', localShippingChoice = '' }) {
  const now = Date.now();
  // `fulfillment: 'local'` = usar o estoque que já está no país do cliente onde houver:
  // esses itens saem de lá, com preço fixo na moeda dele e frete nacional; o resto
  // sai do Japão com a conta de sempre, no MESMO pedido e pagamento (envio separado).
  // Todos de lá = pedido 'local'; parte e parte = 'mixed'. Campanha, promoção da home,
  // negociação e isenção da taxa PS só valem para a parte do Japão.
  const wantsLocal = fulfillment === 'local';
  const currency = currencyForCountry(country);
  const localOffers = [];
  const wantedByProduct = new Map();
  if (wantsLocal && Array.isArray(requestedItems)) {
    for (const requested of requestedItems) {
      const id = String(requested?.productId || '');
      if (id.endsWith('_promo')) continue;
      wantedByProduct.set(id, (wantedByProduct.get(id) || 0) + Number(requested.quantity));
    }
  }
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 100) throw new HttpError(400, 'invalid_items');
  const lineItems = [];
  let homePromoQuantity = 0;
  for (const requested of requestedItems) {
    const quantity = Number(requested.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new HttpError(400, 'invalid_quantity');
    const requestedId = String(requested.productId || '');
    const isHomePromo = requestedId.endsWith('_promo');
    const productId = isHomePromo ? requestedId.replace(/_promo$/, '') : requestedId;
    const product = products.get(productId);
    if (!product || product.hidden === true) throw new HttpError(400, 'invalid_product');
    if (product.deliveryRestrict === 'japan-only' && country !== 'Japão') throw new HttpError(400, 'product_unavailable');
    if (product.deliveryRestrict === 'exterior-only' && country === 'Japão') throw new HttpError(400, 'product_unavailable');
    const variantId = String(requested.variantId || requested.size || 'small');
    let unitYen;
    // Só é local se o estoque de lá cobre TODAS as unidades pedidas do produto
    // (mesma regra de `splitCart`, no navegador); senão o produto inteiro vem do Japão.
    const offer = wantsLocal && !isHomePromo ? localOffer(product, country) : null;
    if (offer && (wantedByProduct.get(productId) || 0) <= offer.quantity) {
      localOffers.push(offer);
      lineItems.push({
        productId, requestedId, product, variantId, quantity,
        unitYen: displayToYen(offer.price, currency, rates),
        unitDisplay: offer.price,
        homePromo: false, freeGift: false, local: true,
      });
      continue;
    }
    if (isHomePromo) {
      if (!homePromotion || homePromotion.productId !== productId || (homePromotion.expiresAt && homePromotion.expiresAt <= now)) throw new HttpError(409, 'promotion_unavailable');
      const limit = Number(homePromotion.limitPerPerson || 1);
      if (quantity > limit) throw new HttpError(409, 'promotion_limit');
      const remaining = homePromotion.maxProducts == null
        ? Infinity
        : Number(homePromotion.maxProducts) - Number(homePromotion.soldCount || 0) - Number(homePromotion.reservedCount || 0);
      if (quantity > remaining) throw new HttpError(409, 'promotion_unavailable');
      unitYen = roundYen(homePromotion.promoPriceYen);
      homePromoQuantity += quantity;
    } else {
      const applies = campaign?.productId === productId ? campaign : null;
      unitYen = discountedYen(product, variantId, applies);
    }
    lineItems.push({ productId, requestedId, product, variantId, quantity, unitYen, homePromo: isHomePromo, freeGift: false });
  }

  const hasLocalLines = lineItems.some((item) => item.local);
  if (wantsLocal && !hasLocalLines) throw new HttpError(409, 'local_unavailable');
  // Tudo sai do país do cliente: campanha, negociação e isenção da taxa PS são do envio do Japão.
  const allLocal = hasLocalLines && lineItems.every((item) => item.local);
  const local = allLocal;
  if (allLocal) {
    campaign = null;
    negotiation = null;
    psFeeWaived = false;
  }

  if (campaign && (campaign.mechanic === 'bogo' || campaign.mechanic === 'bogo_other')) {
    const trigger = lineItems.find((item) => item.productId === campaign.productId && !item.freeGift && !item.local);
    if (trigger) {
      const giftId = campaign.mechanic === 'bogo' ? campaign.productId : campaign.giftProductId;
      const giftProduct = products.get(giftId);
      if (!giftProduct) throw new HttpError(409, 'promotion_unavailable');
      const giftVariant = trigger.productId === giftId ? trigger.variantId : (giftProduct.variants?.[0]?.id || 'small');
      lineItems.push({ productId: giftId, requestedId: giftId, product: giftProduct, variantId: giftVariant, quantity: trigger.quantity, unitYen: 0, homePromo: false, freeGift: true });
    }
  }

  // A conta em ¥ e a conta na moeda do cliente vêm de `shared/money.js`, a
  // MESMA função que a tela usa. O total cobrado é a soma das linhas que o
  // cliente vê — sem desconto escondido por forma de pagamento (o de 5% no
  // cartão/PIX saiu do site em 07/06/2026 e só o servidor continuava dando).
  const lines = lineItems.map((item) => ({
    unitYen: item.unitYen,
    quantity: item.quantity,
    freeGift: item.freeGift,
    homePromo: item.homePromo,
    // Estoque local: preço fixo, sem "desconto do produto" e sem taxa PS.
    productDiscounted: !item.local && Number(item.product.discountPercent || 0) > 0,
    noPsFee: Boolean(item.local) || Boolean(item.product.noPsFee),
    ...(item.local ? { unitDisplay: item.unitDisplay } : {}),
  }));
  const benefits = productBenefits({ lines, coupon, redeemPoints });
  if (benefits.terms?.minOrderYen && benefits.productSubtotalYen < benefits.terms.minOrderYen) {
    throw new HttpError(409, 'coupon_minimum_not_met');
  }

  // Negociação. Manual: a vendedora aprovou (`approvedBy` = e-mail dela).
  // Automática: até ¥300 por unidade, aprovada pelo servidor
  // (`api/orders.js`, ação `negotiation-auto-approve`, `approvedBy: 'system'`).
  // O antigo `approvedBy: 'auto'` era gravado pelo navegador e segue recusado.
  // O teto automático é recalculado sobre o carrinho ATUAL, então negociar com
  // 50 itens e tirar 49 não leva o desconto de 50.
  const negotiationActive = !negotiation?.expiresAt || new Date(negotiation.expiresAt).getTime() > now;
  const manualApproved = Boolean(negotiation?.status === 'approved'
    && negotiation.approvedBy
    && negotiation.approvedBy !== 'auto'
    && negotiation.approvedBy !== 'system'
    && negotiationActive);
  const autoApproved = Boolean(negotiation?.status === 'auto_approved'
    && negotiation.approvedBy === 'system'
    && negotiationActive);
  const psFeeUnits = lines.reduce((sum, line) => (line.freeGift || line.noPsFee ? sum : sum + line.quantity), 0);
  let negotiatedPsYen = 0;
  if (negotiation?.type === 'ps_fee') {
    const approvedYen = Math.max(0, Number(negotiation.approvedDiscountYen || 0));
    if (manualApproved) negotiatedPsYen = approvedYen;
    else if (autoApproved) negotiatedPsYen = Math.min(approvedYen, autoApprovablePsDiscountYen(psFeeUnits));
  }
  const psFeeWaiverApplied = Boolean(psFeeWaived && benefits.psFeeYen > 0 && !benefits.pointsCoverAllProducts);
  const psDiscountYen = psFeeDiscountYen({
    psFeeYen: benefits.psFeeYen,
    pointsCoverAllProducts: benefits.pointsCoverAllProducts,
    psFeeWaived,
    negotiatedDiscountYen: negotiatedPsYen,
  });
  const psFeeFinalYen = benefits.psFeeYen - psDiscountYen;

  // Frete do Japão (itens que vêm de lá) + frete nacional (itens do país do cliente,
  // cadastrado no produto; um pacote só: vale o maior). Cada parte é uma remessa.
  const japanLines = lineItems.filter((item) => !item.local);
  const soloFree = soloFreeShipping(lineItems.map((item) => ({
    quantity: item.quantity,
    freeShippingSolo: item.product.freeShippingSolo,
    local: item.local,
  })));
  const freeShipping = benefits.terms?.freeShipping === true || soloFree;
  let shippingDisplay = null;
  let shipping = { amount: 0, weightG: 0 };
  if (japanLines.length > 0) {
    let shippableYen = benefits.productSubtotalYen - benefits.couponDiscountYen;
    if (hasLocalLines) {
      // Pedido misto: a faixa de frete grátis do Japão olha só a mercadoria que vem de lá.
      const japanYen = japanLines.reduce((sum, item) => sum + (item.freeGift ? 0 : item.unitYen * item.quantity), 0);
      const share = benefits.productSubtotalYen > 0 ? japanYen / benefits.productSubtotalYen : 1;
      shippableYen = japanYen - Math.round(benefits.couponDiscountYen * share);
    }
    shipping = shippingYen(japanLines, country, prefecture, carrier, shippableYen, freeShipping);
  }
  let nationalShippingDisplay = 0;
  if (hasLocalLines) {
    const picked = localOrderShipping(localOffers, { country, state: prefecture || state, choice: localShippingChoice });
    if (!picked) throw new HttpError(409, 'local_shipping_unavailable');
    nationalShippingDisplay = freeShipping ? 0 : picked.price;
    if (allLocal) {
      shippingDisplay = nationalShippingDisplay;
      shipping = { amount: 0, weightG: shippingShape(lineItems).totalWeightG };
    }
  }
  const nationalShippingYen = hasLocalLines ? displayToYen(nationalShippingDisplay, currency, rates) : 0;
  const shippingDiscountYen = manualApproved && negotiation.type === 'shipping'
    ? Math.min(shipping.amount, Math.max(0, Number(negotiation.approvedDiscountYen || 0)))
    : 0;
  const finalShippingYen = Math.max(0, shipping.amount - shippingDiscountYen);

  const shown = displayTotals({
    currency,
    rates,
    country,
    paymentMethod,
    lines,
    benefits,
    finalShippingYen,
    psFeeFinalYen,
    local,
    shippingDisplay,
    localShippingDisplay: nationalShippingDisplay,
  });
  // O imposto é só informativo (ver shared/tax-disclosure.js) e fica fora do
  // total. O imposto dos EUA é outra coisa: pré-pago pela loja (DDP), entra
  // no total como `importDuty`.
  const taxDisplay = local ? 0 : informativeTax(shown.japanProducts, country);
  const total = shown.total;
  if (!(total > 0)) throw new HttpError(400, 'invalid_total');

  // Pontos da campanha "Compre e Ganhe pontos". Até 04/08/2026 o
  // `fulfillment.js` somava `order.promoPoints` no saldo, mas ninguém gravava
  // esse campo — a campanha era anunciada por e-mail/push e creditava zero.
  //
  // Exige o produto da campanha no carrinho, como as outras mecânicas já
  // fazem (`discount` casa por `productId`, `bogo` procura o item gatilho):
  // senão bastava colar o código com qualquer carrinho para levar os pontos.
  // Brinde não conta como gatilho, pelo mesmo motivo.
  const promoPoints = campaign?.mechanic === 'points'
    && lineItems.some((item) => !item.freeGift && !item.local && item.productId === campaign.productId)
    ? Math.max(0, Math.floor(Number(campaign.points || 0)))
    : 0;

  const pointsMultiplier = pointsMultiplierForSpend(recentSpendYen);

  return {
    currency,
    // 'local' = tudo sai do país do cliente; 'mixed' = parte de lá e parte do Japão
    // (um pagamento, dois envios); 'japan' = tudo do Japão.
    fulfillment: allLocal ? 'local' : hasLocalLines ? 'mixed' : 'japan',
    shipFrom: hasLocalLines ? country : 'Japão',
    total,
    totalYen: benefits.netProductsYen + finalShippingYen + nationalShippingYen + psFeeFinalYen,
    productSubtotalYen: benefits.productSubtotalYen,
    netProductsYen: benefits.netProductsYen,
    productCostYen: lineItems.reduce((sum, item) => sum + Math.max(0, Number(item.product.cost || 0)) * item.quantity, 0),
    couponDiscountYen: benefits.couponDiscountYen,
    pointsDiscountYen: benefits.pointsDiscountYen,
    redeemPoints: benefits.pointsDiscountYen,
    earnedPoints: earnedPointsForOrder(benefits.productSubtotalYen, benefits.pointsDiscountYen, pointsMultiplier),
    pointsMultiplier,
    promoPoints,
    shippingYen: finalShippingYen + nationalShippingYen,
    shippingDiscountYen,
    shippingWeightG: shipping.weightG,
    psFeeYen: psFeeFinalYen,
    psFeeDiscountYen: psDiscountYen,
    psFeeWaiverApplied,
    tax: taxDisplay,
    // A conta como o cliente viu, congelada no pedido (`orders.js`,
    // `priceBreakdown`): `subtotal − couponDiscount − pointsDiscount = products`
    // e `products + shipping + psFee + importDuty + paymentFee = total`.
    // `tax` é só informativo. `paymentDiscount` fica em 0 para quem lê pedidos
    // antigos, que ainda têm o desconto de 5%.
    display: {
      subtotal: shown.subtotal,
      couponDiscount: shown.couponDiscount,
      pointsDiscount: shown.pointsDiscount,
      paymentDiscount: 0,
      products: shown.products,
      shipping: shown.shipping,
      // Parte do frete que é nacional (itens enviados do país do cliente); o resto é do Japão.
      localShipping: shown.nationalShipping,
      psFee: shown.psFee,
      // Taxa PS cheia e o quanto foi abatido (isenção, negociação, pontos). A tela de
      // revisão mostra a cheia riscada; sem isto o pedido só guardava o valor final (0)
      // e o e-mail escondia a linha inteira.
      psFeeGross: psDiscountYen > 0
        ? Math.max(shown.psFee, yenToDisplay(psFeeFinalYen + psDiscountYen, currency, rates, { exact: true }))
        : shown.psFee,
      psFeeDiscount: psDiscountYen > 0
        ? Math.max(0, yenToDisplay(psFeeFinalYen + psDiscountYen, currency, rates, { exact: true }) - shown.psFee)
        : 0,
      importDuty: shown.importDuty,
      paymentFee: shown.paymentFee,
      pixIof: shown.pixIof,
      pixBankFee: shown.pixBankFee,
      // Ienes para digitar na Wise (a tela de revisão e o pedido mostram este).
      wiseYen: shown.wiseYen,
      tax: taxDisplay,
    },
    homePromoQuantity,
    items: lineItems.map((item, index) => ({
      productId: item.productId,
      requestedId: item.requestedId,
      productName: String(item.product.name || ''),
      image: item.product.thumbnail || item.product.image || '',
      variantId: item.variantId,
      size: item.variantId,
      variantLabel: variantLabel(item.product, item.variantId),
      quantity: item.quantity,
      unitYen: item.unitYen,
      // Preço unitário na moeda do pedido, exatamente o da tela.
      price: shown.units[index],
      cost: Math.max(0, Number(item.product.cost || 0)),
      productDiscountPercent: Math.max(0, Number(item.product.discountPercent || 0)),
      freeGift: item.freeGift,
      homePromo: item.homePromo,
      stockUnlimited: item.product.stock?.unlimited !== false,
      ...(item.local ? { local: true } : {}),
    })),
  };
}
