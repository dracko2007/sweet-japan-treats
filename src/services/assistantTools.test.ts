import { describe, expect, it, vi } from 'vitest';
import type { CartItem, Product } from '@/types';
import { cartRequested, runAssistantTool, resolveCountry, resolvePrefecture, type ToolContext } from './assistantTools';
import { quoteShipping } from '@/utils/shippingQuote';
import { convertYen } from '@/services/fxService';
import { formatPrice } from '@/utils/currency';

const product = (over: Partial<Product>): Product => ({
  id: 'p', name: 'Produto', description: '', category: 'cosmeticos', prices: { small: 1500, large: 0 },
  image: '/x.jpg', flavor: '', ...over,
} as Product);

const fino = product({ id: 'fino-mask', name: 'Fino Premium Touch Hair Mask', tags: ['máscara capilar'], prices: { small: 1800, large: 0 }, weightGrams: 260 });
const kitkat = product({
  id: 'kitkat-matcha', name: 'KitKat Matcha', category: 'doces', prices: { small: 600, large: 0 },
  variants: [{ id: 'un', label: '1 pacote', price: 600 }, { id: 'kit3', label: 'Kit 3 pacotes', price: 1650 }],
});
const hidden = product({ id: 'secreto', name: 'Fino Secreto', hidden: true });
const soldOut = product({ id: 'esgotado', name: 'Shampoo Esgotado', stock: { unlimited: false, quantity: 0 } });

const ctxFor = (over: Partial<ToolContext> = {}): ToolContext => ({
  products: [fino, kitkat, hidden, soldOut],
  cartItems: [],
  country: 'Brasil',
  language: 'pt',
  addToCart: vi.fn(),
  ...over,
});

const run = (name: string, args: unknown, ctx = ctxFor()) => {
  const out = runAssistantTool(name, JSON.stringify(args), ctx);
  return { ...out, data: JSON.parse(out.content) };
};

describe('assistantTools', () => {
  it('busca produtos visíveis com variantes e preço na moeda do cliente', () => {
    const { data } = run('buscar_produtos', { consulta: 'fino' });
    expect(data.produtos.map((p: { id: string }) => p.id)).toEqual(['fino-mask']);
    expect(data.produtos[0].variantes[0].preco).toBe(formatPrice(convertYen(1800, 'BRL'), 'BRL'));

    const kit = run('buscar_produtos', { consulta: 'kitkat' }).data.produtos[0];
    expect(kit.variantes.map((v: { id: string }) => v.id)).toEqual(['un', 'kit3']);
  });

  it('cota o pedido com os mesmos valores do checkout (frete + taxa de serviço)', () => {
    const { data } = run('cotar_pedido', { itens: [{ produto_id: 'fino-mask', quantidade: 2 }], pais: 'brazil' });
    expect(data.ok).toBe(true);
    expect(data.pais).toBe('Brasil');

    const items: CartItem[] = [{ product: fino, size: 'small', quantity: 2 }];
    const quote = quoteShipping(items, 'Brasil');
    const subtotal = convertYen(1800, 'BRL') * 2;
    const ps = convertYen(2000, 'BRL', true);
    const firstPaid = quote.options.find((o) => !o.isConsultar)!;
    expect(data.subtotal_produtos).toBe(formatPrice(subtotal, 'BRL'));
    expect(data.opcoes_frete[0].frete).toBe(formatPrice(firstPaid.cost, 'BRL'));
    expect(data.opcoes_frete[0].total_com_frete_e_taxa).toBe(formatPrice(subtotal + firstPaid.cost + ps, 'BRL'));
    // Brasil: igual ao carrinho, só o aviso (sem número de imposto).
    expect(data.imposto_estimado).toBeUndefined();
    expect(data.aviso_impostos).toContain('não é cobrada pela loja');

    const pt = run('cotar_pedido', { itens: [{ produto_id: 'fino-mask' }], pais: 'Portugal' }).data;
    expect(pt.moeda).toBe('EUR');
    expect(pt.imposto_estimado).toContain('NÃO pela loja');
  });

  it('no Japão pede a província antes de dar o frete', () => {
    expect(run('cotar_pedido', { itens: [{ produto_id: 'fino-mask' }], pais: 'Japão' }).data.frete).toBe('precisa_da_provincia');
    const { data } = run('cotar_pedido', { itens: [{ produto_id: 'fino-mask' }], pais: 'japan', provincia: 'Hiroshima-ken' });
    expect(data.opcoes_frete.length).toBe(3);
    expect(data.imposto_estimado).toBeUndefined();
  });

  it('país desconhecido e carrinho vazio viram erro claro, sem inventar', () => {
    expect(run('cotar_pedido', { pais: 'Atlântida' }).data.erro).toBe('pais_desconhecido');
    expect(run('cotar_pedido', {}).data.erro).toBe('carrinho_vazio');
  });

  it('adiciona ao carrinho com a variante pedida e a cotação seguinte já enxerga o item', () => {
    const ctx = ctxFor();
    const add = run('adicionar_ao_carrinho', { produto_id: 'kitkat-matcha', variante_id: 'kit3', quantidade: 2 }, ctx);
    expect(ctx.addToCart).toHaveBeenCalledWith(kitkat, 'kit3', 2, 'Kit 3 pacotes');
    expect(add.ui?.cartChanged).toBe(true);

    const cart = run('ver_carrinho', {}, ctx).data;
    expect(cart.itens).toEqual([expect.objectContaining({ produto_id: 'kitkat-matcha', variante: 'Kit 3 pacotes', quantidade: 2 })]);
  });

  it('não adiciona produto oculto, esgotado ou inexistente', () => {
    const ctx = ctxFor();
    expect(run('adicionar_ao_carrinho', { produto_id: 'secreto' }, ctx).data.erro).toBe('produto_nao_encontrado');
    expect(run('adicionar_ao_carrinho', { produto_id: 'esgotado' }, ctx).data.erro).toBe('esgotado');
    expect(ctx.addToCart).not.toHaveBeenCalled();
  });

  it('converte moeda com o câmbio do site', () => {
    const { data } = run('converter_moeda', { valor: 10000, de: 'JPY', para: 'BRL' });
    expect(data.para).toBe(formatPrice(convertYen(10000, 'BRL'), 'BRL', true));
    expect(run('converter_moeda', { valor: 10, de: 'XYZ', para: 'BRL' }).data.ok).toBe(false);
  });

  it('mostrar_opcoes só aceita produtos visíveis e ações conhecidas', () => {
    const out = run('mostrar_opcoes', { produtos: ['fino-mask', 'secreto', 'nada'], acoes: ['finalizar_compra', 'apagar_tudo'] });
    expect(out.ui?.products?.map((p) => p.id)).toEqual(['fino-mask']);
    expect(out.ui?.actions).toEqual(['finalizar_compra']);
  });

  it('busca ignora palavras soltas como "de" e aceita quantidade com nome de campo errado', () => {
    const joseon = product({ id: 'joseon', name: 'Beauty of Joseon Glow Deep Serum' });
    const ctx = ctxFor({ products: [fino, kitkat, joseon] });
    expect(run('buscar_produtos', { consulta: 'cartas de pokemon' }, ctx).data.produtos).toEqual([]);
    const q = run('cotar_pedido', { itens: [{ produto_id: 'fino-mask', quantidade_1: 3 }] }, ctx).data;
    expect(q.itens[0].quantidade).toBe(3);
  });

  it('reconhece pedido de carrinho em pt/en/ja e o "sim" de confirmação', () => {
    expect(cartRequested('pode colocar no carrinho')).toBe(true);
    expect(cartRequested('add them to my cart')).toBe(true);
    expect(cartRequested('カートに入れて')).toBe(true);
    expect(cartRequested('quanto fica tudo com frete?')).toBe(false);
    expect(cartRequested('sim', 'Quer que eu adicione ao carrinho?')).toBe(true);
    expect(cartRequested('sim', 'Quer ver outro país?')).toBe(false);
  });

  it('reconhece país e província escritos de vários jeitos', () => {
    expect(resolveCountry('EUA', 'Brasil')).toBe('Estados Unidos');
    expect(resolveCountry('portugal', 'Brasil')).toBe('Portugal');
    expect(resolveCountry(undefined, 'Brasil')).toBe('Brasil');
    expect(resolveCountry('日本', 'Brasil')).toBe('Japão');
    expect(resolvePrefecture('東京')).toBe('Tokyo');
    expect(resolvePrefecture('広島県')).toBe('Hiroshima');
    expect(resolvePrefecture('hiroshima')).toBe('Hiroshima');
  });
});
