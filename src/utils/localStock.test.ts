import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/fxService', () => ({ getMoneyRates: () => ({ BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150, source: 'wise' }) }));

import type { CartItem, Product } from '@/types';
import { computeCheckoutTotals } from './checkoutTotals';
import { localOffer, localShippingChoices, localShippingFor, splitCart } from './localStock';

const base = { category: 'cosmeticos', description: '', image: 'x', prices: { small: 1450, large: 0 } } as unknown as Product;
const noBrasil = { ...base, id: 'fino', name: 'Fino', discountPercent: 10, localStock: { Brasil: { enabled: true, price: 89, quantity: 2, shippingOptions: [{ name: 'Sul', price: 22 }] } } } as Product;
const doJapao = { ...base, id: 'tsubaki', name: 'Tsubaki' } as Product;
const item = (product: Product, quantity = 1): CartItem => ({ product, size: 'small', quantity } as CartItem);

describe('estoque local no navegador', () => {
  it('só há oferta local no país do estoque, com preço e unidades preenchidos', () => {
    expect(localOffer(noBrasil, 'Brasil')).toEqual({ price: 89, listPrice: 89, discountPercent: 0, quantity: 2, shippingOptions: [{ name: 'Sul', price: 22 }] });
    // Sem frete cadastrado o produto não vende do país (nunca sai com frete grátis por engano).
    expect(localOffer({ ...noBrasil, localStock: { Brasil: { enabled: true, price: 89, quantity: 2 } } } as Product, 'Brasil')).toBeNull();
    expect(localOffer({ ...noBrasil, localStock: { Brasil: { enabled: true, price: 89, quantity: 2, shippingOptions: [{ name: 'Sul', price: 0 }] } } } as Product, 'Brasil')?.shippingOptions[0].price).toBe(0);
    expect(localOffer(noBrasil, 'Portugal')).toBeNull();
    expect(localOffer(doJapao, 'Brasil')).toBeNull();
    expect(localOffer({ ...noBrasil, localStock: { Brasil: { enabled: true, price: 89, quantity: 0, shippingOptions: [{ name: 'Sul', price: 22 }] } } } as Product, 'Brasil')).toBeNull();
  });

  it('separa o carrinho em local, Japão ou misto', () => {
    expect(splitCart([item(noBrasil)], 'Brasil').kind).toBe('local');
    expect(splitCart([item(doJapao)], 'Brasil').kind).toBe('japan');
    expect(splitCart([item(noBrasil), item(doJapao)], 'Brasil').kind).toBe('mixed');
    // Mesmo carrinho visto de outro país: tudo vem do Japão.
    expect(splitCart([item(noBrasil)], 'Portugal').kind).toBe('japan');
    // Pediu mais do que há no Brasil: esse item passa a vir do Japão.
    expect(splitCart([item(noBrasil, 3)], 'Brasil').kind).toBe('japan');
  });

  it('pedido local: preço fixo + frete nacional, sem taxa PS, câmbio ou desconto do produto', () => {
    const totals = computeCheckoutTotals({
      items: [item(noBrasil, 2)],
      currency: 'BRL',
      country: 'Brasil',
      paymentMethod: 'pix',
      shippingYen: 99999, // ignorado no pedido local
      psFeeWaived: true,
      local: { country: 'Brasil', currency: 'BRL', shippingDisplay: 22 },
    });
    expect(totals.shown).toMatchObject({ subtotal: 178, products: 178, shipping: 22, psFee: 0, paymentFee: 0, total: 200 });
    expect(totals.psFeeYen).toBe(0);
  });

  it('o mesmo carrinho enviado do Japão usa a conta de sempre (com taxa PS)', () => {
    const totals = computeCheckoutTotals({ items: [item(noBrasil, 2)], currency: 'BRL', country: 'Brasil', shippingYen: 2000 });
    expect(totals.psFeeYen).toBe(2000);
    expect(totals.shown.total).not.toBe(200);
  });

  it('cupom percentual desconta do preço local', () => {
    const totals = computeCheckoutTotals({
      items: [item(noBrasil)], currency: 'BRL', country: 'Brasil',
      coupon: { discount: 10, discountType: 'percentage' }, shippingYen: 0,
      local: { country: 'Brasil', currency: 'BRL', shippingDisplay: 22 },
    });
    expect(totals.shown).toMatchObject({ couponDiscount: 9, products: 80, total: 102 });
  });

  it('frete nacional: região do cliente, escolha quando não combina, maior frete entre produtos', () => {
    const regioes = { ...noBrasil, id: 'regioes', localStock: { Brasil: { enabled: true, price: 50, quantity: 5, shippingOptions: [{ name: 'Sul', price: 29 }, { name: 'Sudeste', price: 22 }] } } } as Product;
    const item = (product: Product) => ({ product, size: 'small', quantity: 1 }) as unknown as import('@/types').CartItem;
    expect(localShippingFor([item(regioes)], 'Brasil', 'SP')).toEqual({ name: 'Sudeste', price: 22 });
    expect(localShippingFor([item(regioes)], 'Brasil', 'BA')).toBeNull();
    expect(localShippingFor([item(regioes)], 'Brasil', 'BA', 'Sul')?.price).toBe(29);
    expect(localShippingChoices([item(regioes)], 'Brasil', 'BA').map((option) => option.name)).toEqual(['Sul', 'Sudeste']);
    // Dois produtos: um pacote só, vale o maior.
    expect(localShippingFor([item(regioes), item(noBrasil)], 'Brasil', 'SP')?.price).toBe(22);
    expect(localShippingFor([item(regioes), item(noBrasil)], 'Brasil', 'RS')?.price).toBe(29);
  });

  it('desconto opcional do estoque local: price é o cobrado, listPrice o de tabela', () => {
    const comDesconto = (percent: number) => ({ ...noBrasil, localStock: { Brasil: { enabled: true, price: 89, quantity: 2, discountPercent: percent, shippingOptions: [{ name: 'Sul', price: 22 }] } } }) as Product;
    expect(localOffer(comDesconto(10), 'Brasil')).toMatchObject({ price: 80, listPrice: 89, discountPercent: 10 });
    expect(localOffer(comDesconto(0), 'Brasil')).toMatchObject({ price: 89, listPrice: 89, discountPercent: 0 });
    // Acima de 90% é ignorado (erro de digitação não vira produto quase de graça).
    expect(localOffer(comDesconto(95), 'Brasil')?.price).toBe(89);
  });
});
