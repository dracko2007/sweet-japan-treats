import { describe, expect, it } from 'vitest';
import { buildQuote } from './commerce.js';

const rates = { BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150, source: 'fallback' };
const product = {
  id: 'p1',
  name: 'Produto',
  prices: { small: 1000, large: 2000 },
  weightGrams: 500,
  stock: { unlimited: false, quantity: 10 },
};

function quote(overrides = {}) {
  return buildQuote({
    requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 1 }],
    products: new Map([['p1', product]]),
    country: 'Brasil',
    prefecture: 'SP',
    state: 'SP',
    carrier: 'ems',
    paymentMethod: 'card',
    coupon: null,
    redeemPoints: 0,
    negotiation: null,
    campaign: null,
    homePromotion: null,
    rates,
    ...overrides,
  });
}

describe('authoritative checkout quote', () => {
  it('derives item price and regional currency from server data', () => {
    const result = quote({ requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 2, price: 1, total: 1 }] });
    expect(result.items[0].unitYen).toBe(1000);
    expect(result.productSubtotalYen).toBe(2000);
    // Sem desconto escondido no cartão: o de 5% saiu do site em 07/06/2026.
    expect(result.netProductsYen).toBe(2000);
    expect(result.currency).toBe('BRL');
    expect(result.total).toBeGreaterThan(1);
  });

  it('grava o nome da opção como a loja mostra (para o e-mail do pedido)', () => {
    expect(quote().items[0].variantLabel).toBe('Pequeno');
    const kit = { ...product, variants: [{ id: 'u', label: 'Unidade', price: 500 }, { id: 'kit-3', label: 'Kit 3 unidades', price: 1400 }] };
    expect(quote({ products: new Map([['p1', kit]]), requestedItems: [{ productId: 'p1', variantId: 'kit-3', quantity: 1 }] }).items[0].variantLabel).toBe('Kit 3 unidades');
    const unica = { ...product, variants: [{ id: 'u', label: 'Unidade', price: 500 }] };
    expect(quote({ products: new Map([['p1', unica]]), requestedItems: [{ productId: 'p1', variantId: 'u', quantity: 1 }] }).items[0].variantLabel).toBe('');
  });

  it('uses USD outside Brazil, Japan, and the eurozone', () => {
    expect(quote({ country: 'Canadá' }).currency).toBe('USD');
    expect(quote({ country: 'Portugal' }).currency).toBe('EUR');
    expect(quote({ country: 'Japão', prefecture: 'Tokyo', carrier: 'yuubin' }).currency).toBe('JPY');
  });

  it('rejects a home promotion quantity above the per-person limit', () => {
    expect(() => quote({
      requestedItems: [{ productId: 'p1_promo', variantId: 'small', quantity: 2 }],
      homePromotion: { productId: 'p1', promoPriceYen: 500, limitPerPerson: 1, maxProducts: 10, soldCount: 0 },
    })).toThrowError('promotion_limit');
  });

  it('reconstructs campaign gifts instead of trusting free client lines', () => {
    const gift = { ...product, id: 'gift', name: 'Brinde', stock: { unlimited: false, quantity: 4 } };
    const result = quote({
      products: new Map([['p1', product], ['gift', gift]]),
      campaign: { mechanic: 'bogo_other', productId: 'p1', giftProductId: 'gift', keepProductDiscount: true },
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toMatchObject({ productId: 'gift', freeGift: true, unitYen: 0, quantity: 1 });
  });

  it('rejects a carrier that is unavailable for the cart weight', () => {
    expect(() => quote({ carrier: 'kozutsumi-air' })).toThrowError('invalid_shipping');
  });

  // Regressão do CRÍTICO #1 do AUDITORIA.md: o cupom de recuperação de
  // carrinho grava o percentual em `discountPercent` e deixa `discount: 0`
  // (legado). Lendo `discount` no ramo 'percentage', todo cupom de
  // recuperação valia 0% — a tela prometia 30% OFF e o pedido saía cheio.
  it('aplica o percentual do cupom de recuperação, que vem em discountPercent', () => {
    const result = quote({
      requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 1 }],
      coupon: { code: 'VOLTA30', type: 'percent', discountType: 'percentage', discount: 0, discountPercent: 30 },
    });
    expect(result.couponDiscountYen).toBe(300);
  });

  it('mantém o cupom global, que traz o percentual em discount', () => {
    const result = quote({
      coupon: { code: 'GLOBAL10', discountType: 'percentage', discount: 10 },
    });
    expect(result.couponDiscountYen).toBe(100);
  });

  // Regressão do CRÍTICO #3: `remaining` era calculado e descartado. O limite
  // de unidades só era conferido no fulfillment — depois de cobrar o cartão,
  // deixando o pedido preso em `payment_review`.
  it('recusa a promoção da home quando o estoque promocional acabou', () => {
    expect(() => quote({
      requestedItems: [{ productId: 'p1_promo', variantId: 'small', quantity: 1 }],
      homePromotion: { productId: 'p1', promoPriceYen: 500, limitPerPerson: 5, maxProducts: 10, soldCount: 10 },
    })).toThrowError('promotion_unavailable');
  });

  it('conta as reservas em aberto no limite da promoção', () => {
    expect(() => quote({
      requestedItems: [{ productId: 'p1_promo', variantId: 'small', quantity: 2 }],
      homePromotion: { productId: 'p1', promoPriceYen: 500, limitPerPerson: 5, maxProducts: 10, soldCount: 8, reservedCount: 1 },
    })).toThrowError('promotion_unavailable');
  });

  it('ainda vende enquanto sobra unidade promocional', () => {
    const result = quote({
      requestedItems: [{ productId: 'p1_promo', variantId: 'small', quantity: 2 }],
      homePromotion: { productId: 'p1', promoPriceYen: 500, limitPerPerson: 5, maxProducts: 10, soldCount: 8 },
    });
    expect(result.homePromoQuantity).toBe(2);
  });

  // Regressão do MEDIO 1 do AUDITORIA.md: o `fulfillment.js` somava
  // `order.promoPoints` no saldo do cliente, mas nenhum lugar gravava esse
  // campo. A campanha "Compre e Ganhe pontos" era anunciada por e-mail e push
  // e creditava zero.
  it('credita os pontos da campanha quando o produto dela está no carrinho', () => {
    const result = quote({
      campaign: { mechanic: 'points', productId: 'p1', points: 250 },
    });
    expect(result.promoPoints).toBe(250);
  });

  // As outras mecânicas são todas presas ao produto da campanha. Sem isto
  // bastava colar o código com qualquer carrinho para levar os pontos.
  it('não credita se o produto da campanha não está no carrinho', () => {
    const outro = { ...product, id: 'p2' };
    const result = quote({
      requestedItems: [{ productId: 'p2', variantId: 'small', quantity: 1 }],
      products: new Map([['p2', outro]]),
      campaign: { mechanic: 'points', productId: 'p1', points: 250 },
    });
    expect(result.promoPoints).toBe(0);
  });

  it('não credita ponto em campanha de outra mecânica', () => {
    const result = quote({
      campaign: { mechanic: 'discount', productId: 'p1', discountPct: 10, points: 250 },
    });
    expect(result.promoPoints).toBe(0);
  });

  it('pedido sem campanha não gera ponto promocional', () => {
    expect(quote().promoPoints).toBe(0);
  });

  // Regressão do BAIXO 1 do AUDITORIA.md: produtos, frete e subtotal eram
  // convertidos cada um por conta própria, com cushion de 4% mais ¥5 de buffer
  // por linha, enquanto cupom, pontos e taxa PS iam pela taxa exata. O cushion
  // nunca alcançava os descontos, então a conta da tela ficava 4% dos descontos
  // acima do total cobrado — cerca de R$2 num pedido com ¥1.500 de cupom.
  // A prova é que a soma das linhas exibidas (SEM o imposto, que é só
  // informativo — ver BUG1/commerce.js `buildQuote`) fecha exatamente com o total.
  it('a soma das linhas exibidas (produtos+frete+taxa PS) fecha com o total, sem o imposto', () => {
    const result = quote({
      requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 3 }],
      coupon: { code: 'GLOBAL10', discountType: 'percentage', discount: 10 },
      redeemPoints: 500,
    });
    const { subtotal, couponDiscount, pointsDiscount, products, shipping, psFee } = result.display;

    // Sem estas parcelas o teste passaria por vacuidade.
    expect(couponDiscount).toBeGreaterThan(0);
    expect(pointsDiscount).toBeGreaterThan(0);
    expect(shipping).toBeGreaterThan(0);
    expect(psFee).toBeGreaterThan(0);

    // A invariante essencial: as linhas cobradas somam exatamente o total.
    // Toda linha é inteira (R$), como a tela mostra.
    for (const valor of [subtotal, couponDiscount, pointsDiscount, products, shipping, psFee, result.total]) {
      expect(Number.isInteger(valor)).toBe(true);
    }
    expect(subtotal - couponDiscount - pointsDiscount).toBe(products);
    expect(products + shipping + psFee).toBe(result.total);
  });

  // A tela converte CADA unidade e arredonda para inteiro; o subtotal é a soma
  // dessas unidades. O servidor cobrava o total convertido de uma vez, com
  // centavos, e a diferença aparecia na fatura.
  it('cobra a soma das unidades exatamente como a tela converte', () => {
    const wise = { BRL: 0.0347798, EUR: 0.00566316, USD: 0.00630994, source: 'wise' };
    const result = quote({ requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 3 }], rates: wise });
    const unidade = Math.round((1000 + 5) * wise.BRL);
    expect(result.items[0].price).toBe(unidade);
    expect(result.display.subtotal).toBe(unidade * 3);
    expect(result.display.psFee).toBe(Math.round(3000 * wise.BRL));
  });

  it('cartão e Wise cobram o mesmo valor: não existe desconto por forma de pagamento', () => {
    expect(quote({ paymentMethod: 'card' }).total).toBe(quote({ paymentMethod: 'wise' }).total);
    expect(quote({ paymentMethod: 'card' }).display.paymentDiscount).toBe(0);
  });

  // A tela do PIX sempre somou IOF 3,5% + R$32; a cobrança não somava.
  it('PIX soma o IOF e a tarifa bancária que a tela mostra', () => {
    const semTaxa = quote({ paymentMethod: 'wise' });
    const pix = quote({ paymentMethod: 'pix' });
    const iof = Math.round(semTaxa.total * 0.035);
    expect(pix.display.pixIof).toBe(iof);
    expect(pix.display.pixBankFee).toBe(32);
    expect(pix.total).toBe(semTaxa.total + iof + 32);
  });

  it('EUA: só EMS, com o imposto pré-pago (DDP) no total', () => {
    expect(() => quote({ country: 'Estados Unidos', carrier: 'eraito' })).toThrowError('shipping_unavailable');
    const result = quote({ country: 'Estados Unidos', carrier: 'ems', state: 'CA' });
    const { products, shipping, psFee, importDuty, tax } = result.display;
    expect(importDuty).toBe(Math.round(products * 0.125 + 2.77));
    expect(tax).toBe(0);
    expect(products + shipping + psFee + importDuty).toBe(result.total);
  });

  it('Brasil não grava estimativa de imposto que a tela não mostra', () => {
    expect(quote().tax).toBe(0);
    expect(quote({ country: 'Portugal' }).tax).toBeGreaterThan(0);
  });

  it('cupom fixo é em ienes, nunca na moeda do cliente', () => {
    const result = quote({ coupon: { code: 'MENOS500', discountType: 'fixed', discount: 500 } });
    expect(result.couponDiscountYen).toBe(500);
    expect(result.display.couponDiscount).toBe(Math.round(500 * rates.BRL * 1.04));
  });

  describe('negociação da taxa PS', () => {
    const pendente = { type: 'ps_fee', approvedDiscountYen: 300, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };

    it('aprovação automática do servidor vale até ¥300 por unidade do carrinho atual', () => {
      const negotiation = { ...pendente, status: 'auto_approved', approvedBy: 'system', approvedDiscountYen: 900 };
      const result = quote({ requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 2 }], negotiation });
      expect(result.psFeeDiscountYen).toBe(600);
      expect(result.psFeeYen).toBe(1400);
    });

    it('aprovação manual da vendedora vale o valor aprovado', () => {
      const negotiation = { ...pendente, status: 'approved', approvedBy: 'loja@example.com', approvedDiscountYen: 700 };
      expect(quote({ negotiation }).psFeeYen).toBe(300);
    });

    it('recusa a antiga aprovação gravada pelo navegador', () => {
      const negotiation = { ...pendente, status: 'auto_approved', approvedBy: 'auto' };
      expect(quote({ negotiation }).psFeeYen).toBe(1000);
    });

    it('negociação vencida não dá desconto', () => {
      const negotiation = { ...pendente, status: 'approved', approvedBy: 'loja@example.com', expiresAt: new Date(Date.now() - 1000).toISOString() };
      expect(quote({ negotiation }).psFeeYen).toBe(1000);
    });
  });

  // Iene não tem centavo: a taxa efetiva é 1 e cada linha exibida é o próprio
  // valor em iene, sem sobra de arredondamento para realocar.
  it('o caminho do iene fica inteiro e o total exibido é o cobrado', () => {
    const result = quote({
      country: 'Japão', prefecture: 'Tokyo', carrier: 'yuubin',
      coupon: { code: 'GLOBAL10', discountType: 'percentage', discount: 10 },
    });
    const { subtotal, couponDiscount, pointsDiscount, products, shipping, psFee, tax } = result.display;

    for (const valor of [subtotal, couponDiscount, products, shipping, psFee, tax, result.total]) {
      expect(Number.isInteger(valor)).toBe(true);
    }
    expect(tax).toBe(0);
    expect(result.total).toBe(result.totalYen);
    expect(subtotal - couponDiscount - pointsDiscount).toBe(products);
    expect(products + shipping + psFee).toBe(result.total);
  });
});

describe('frete: tabelas conferidas no Japan Post (2026-11-08)', () => {
  it('Yu-Pack usa a tabela oficial de Hiroshima', () => {
    expect(quote({ country: 'Japão', prefecture: 'Tokyo', carrier: 'yuubin' }).shippingYen).toBe(1270);
    expect(quote({ country: 'Japão', prefecture: 'Hiroshima', carrier: 'yuubin' }).shippingYen).toBe(840);
  });

  it('EMS para os EUA acima de 10 kg segue a tabela oficial (11 kg = ¥29.500)', async () => {
    const { emsRateYen } = await import('./commerce.js');
    expect(emsRateYen(11000, 4)).toBe(29500);
    expect(emsRateYen(16000, 4)).toBe(41500);
    expect(emsRateYen(30000, 4)).toBe(75100);
  });

  it('peso conferido não leva margem: 3 finos de 303 g = 909 g + 100 g da caixa', () => {
    const fino = { ...product, weightGrams: 303, weightVerified: true };
    const result = quote({
      carrier: 'eraito',
      products: new Map([['p1', fino]]),
      requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 3 }],
    });
    // Sem margem por unidade; só a caixa com plástico-bolha, uma vez por pacote.
    expect(result.shippingWeightG).toBe(1009);
  });
});


// Produto que já está no país do cliente (empresa parceira): preço fixo na
// moeda de lá, frete nacional de tabela, sem câmbio nem taxas de importação.
describe('pedido de estoque local', () => {
  const noBrasil = { ...product, discountPercent: 20, localStock: { Brasil: { enabled: true, price: 89, quantity: 3 } } };
  const tabela = { Brasil: { regions: { sul: 30, sudeste: 22, centroOeste: 35, nordeste: 40, norte: 55 } }, Portugal: { flat: 6 } };
  const local = (overrides = {}) => quote({
    products: new Map([['p1', noBrasil]]),
    fulfillment: 'local',
    localShipping: tabela,
    ...overrides,
  });

  it('cobra o preço fixo em real + PAC da região, sem câmbio, taxa PS ou desconto do produto', () => {
    const result = local({ requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 2 }] });
    expect(result.currency).toBe('BRL');
    expect(result.fulfillment).toBe('local');
    expect(result.shipFrom).toBe('Brasil');
    expect(result.items[0].price).toBe(89);
    expect(result.display).toMatchObject({ subtotal: 178, products: 178, shipping: 22, psFee: 0, importDuty: 0, paymentFee: 0 });
    expect(result.total).toBe(200);
    expect(result.psFeeYen).toBe(0);
  });

  it('o câmbio não muda o valor cobrado', () => {
    const outroCambio = { ...rates, BRL: 1 / 20 };
    expect(local({ rates: outroCambio }).total).toBe(local().total);
  });

  it('PIX local não tem IOF nem tarifa de remessa', () => {
    const result = local({ paymentMethod: 'pix' });
    expect(result.display.paymentFee).toBe(0);
    expect(result.total).toBe(89 + 22);
  });

  it('frete muda por região (UF ou nome do estado) e precisa estar na tabela', () => {
    expect(local({ prefecture: 'AM' }).display.shipping).toBe(55);
    expect(local({ prefecture: '', state: 'Rio Grande do Sul' }).display.shipping).toBe(30);
    expect(() => local({ prefecture: 'XX', state: '' })).toThrow(expect.objectContaining({ code: 'local_shipping_unavailable' }));
    expect(() => local({ localShipping: null })).toThrow(expect.objectContaining({ code: 'local_shipping_unavailable' }));
  });

  it('cupom percentual vale sobre o preço local; frete grátis zera o PAC', () => {
    expect(local({ coupon: { discount: 10, discountType: 'percentage' } }).display).toMatchObject({ couponDiscount: 9, products: 80, shipping: 22 });
    expect(local({ coupon: { freeShipping: true } }).total).toBe(89);
  });

  it('recusa produto sem estoque local, quantidade acima do estoque e país sem oferta', () => {
    expect(() => local({ products: new Map([['p1', product]]) })).toThrow(expect.objectContaining({ code: 'local_unavailable' }));
    expect(() => local({ requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 4 }] })).toThrow(expect.objectContaining({ code: 'insufficient_stock' }));
    expect(() => local({ country: 'Portugal', prefecture: '' })).toThrow(expect.objectContaining({ code: 'local_unavailable' }));
    const desligado = { ...noBrasil, localStock: { Brasil: { enabled: false, price: 89, quantity: 3 } } };
    expect(() => local({ products: new Map([['p1', desligado]]) })).toThrow(expect.objectContaining({ code: 'local_unavailable' }));
  });

  it('em outro país usa a moeda e o frete único de lá', () => {
    const emPortugal = { ...product, localStock: { Portugal: { enabled: true, price: 15, quantity: 5 } } };
    const result = local({ products: new Map([['p1', emPortugal]]), country: 'Portugal', prefecture: '' });
    expect(result.currency).toBe('EUR');
    expect(result.total).toBe(15 + 6);
  });

  it('o mesmo produto enviado do Japão continua com a conta de sempre', () => {
    const doJapao = quote({ products: new Map([['p1', noBrasil]]) });
    expect(doJapao.fulfillment).toBe('japan');
    expect(doJapao.psFeeYen).toBeGreaterThan(0);
    expect(doJapao.total).toBe(quote({ products: new Map([['p1', { ...product, discountPercent: 20 }]]) }).total);
  });
});
