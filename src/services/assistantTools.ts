/**
 * Ferramentas do assistente virtual. A IA (Gemini) decide QUAL ferramenta usar;
 * quem calcula é sempre este código — os mesmos cálculos do carrinho/checkout
 * (preço por variante, câmbio com a margem do site, frete por peso, taxa de
 * serviço). Assim todo número que o assistente diz vem daqui, nunca da IA.
 *
 * Cada ferramenta devolve um texto JSON (o que a IA lê) e, quando for o caso,
 * botões/cards para a tela (`ui`).
 */
import type { CartItem, Product } from '@/types';
import { WORLD_COUNTRIES, getCountryConfig } from '@/data/worldCountries';
import { japanPrefectures } from '@/data/japanPrefectures';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen, getVariants, hasDiscount } from '@/utils/pricing';
import { convertYen, yenFromConverted } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';
import { quoteShipping, JAPAN_FREE_SHIPPING_MIN_YEN } from '@/utils/shippingQuote';
import { MAX_WEIGHT_G } from '@/utils/japanPostRates';
import { taxDisclosure } from '../../shared/tax-disclosure.js';

export type AssistantAction = 'finalizar_compra' | 'ver_carrinho' | 'continuar_comprando' | 'falar_whatsapp' | 'faca_seu_pedido';
export const ASSISTANT_ACTIONS: AssistantAction[] = ['finalizar_compra', 'ver_carrinho', 'continuar_comprando', 'falar_whatsapp', 'faca_seu_pedido'];

export interface ToolUi {
  products?: Product[];
  actions?: AssistantAction[];
  /** Algo foi adicionado ao carrinho nesta rodada. */
  cartChanged?: boolean;
}

export interface ToolResult {
  content: string;
  ui?: ToolUi;
}

export interface ToolContext {
  products: Product[];
  cartItems: CartItem[];
  /** País escolhido no site (define moeda padrão). */
  country: string;
  language: 'pt' | 'en' | 'ja';
  addToCart: (product: Product, size: string, quantity?: number, variantLabel?: string) => void;
  /** false = o cliente não pediu para mexer no carrinho nesta mensagem (ver cartRequested). */
  allowCartChanges?: boolean;
}

// Pedido explícito de carrinho, em pt/en/ja.
const CART_REQUEST_RE = /adicion|coloc|carrinho|\bbot(a|e)\b|\bp(o|õ)e\b|inclu(i|a)|\badd\b|\bcart\b|カート|追加|入れ/i;
const YES_RE = /^\s*(sim|s|pode|pode sim|ok|okay|isso|claro|quero|yes|yep|sure|please|go ahead|はい|お願い|うん)\b/i;

/**
 * A IA só pode adicionar ao carrinho se o cliente pediu — nesta mensagem, ou
 * respondendo "sim" a uma pergunta sobre o carrinho. Modelos menores chegaram a
 * adicionar itens quando o cliente só perguntou o preço (teste real, out/2026).
 */
export function cartRequested(lastUserText: string, lastAssistantText = ''): boolean {
  if (CART_REQUEST_RE.test(lastUserText)) return true;
  return YES_RE.test(lastUserText) && CART_REQUEST_RE.test(lastAssistantText);
}

const PS_FEE_YEN_PER_UNIT = 1000;
const MAX_QTY = 20;

const json = (data: unknown): ToolResult => ({ content: JSON.stringify(data) });
const fail = (erro: string, extra: Record<string, unknown> = {}): ToolResult => json({ ok: false, erro, ...extra });

export const normalize = (s: string): string =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------- País / província ----------

const COUNTRY_ALIASES: Record<string, string> = {
  brazil: 'Brasil', br: 'Brasil', japan: 'Japão', japao: 'Japão', jp: 'Japão', nihon: 'Japão', '日本': 'Japão', 'ブラジル': 'Brasil',
  'アメリカ': 'Estados Unidos', 'ポルトガル': 'Portugal',
  usa: 'Estados Unidos', us: 'Estados Unidos', eua: 'Estados Unidos', 'united states': 'Estados Unidos',
  france: 'França', franca: 'França', italy: 'Itália', italia: 'Itália', spain: 'Espanha', espana: 'Espanha',
  portugal: 'Portugal', germany: 'Alemanha', uk: 'Reino Unido', 'united kingdom': 'Reino Unido', canada: 'Canadá',
  mexico: 'México',
};

export function resolveCountry(input: string | undefined, fallback: string): string | null {
  if (!input || !input.trim()) return fallback;
  const n = normalize(input);
  const byName = WORLD_COUNTRIES.find((c) => normalize(c.name) === n || c.iso === n);
  if (byName) return byName.name;
  const alias = COUNTRY_ALIASES[n];
  return alias && getCountryConfig(alias) ? alias : null;
}

export function resolvePrefecture(input: string | undefined): string | null {
  if (!input) return null;
  const n = normalize(input).replace(/[-\s]?(ken|fu|to|prefecture|provincia)$/, '').replace(/[県府都道]$/, '');
  const found = japanPrefectures.find((p) => normalize(p.name) === n || p.nameJa.replace(/[県府都道]$/, '') === input.replace(/[県府都道]$/, ''));
  return found?.name ?? null;
}

// ---------- Produtos ----------

const visible = (products: Product[]) => products.filter((p) => !p.hidden);

const isSoldOut = (p: Product) => Boolean(p.stock && !p.stock.unlimited && p.stock.quantity <= 0);

function productHaystack(p: Product): string {
  const i18nNames = Object.values(p.i18n || {}).map((v) => v?.name || '').join(' ');
  return normalize([p.name, productEnglishName(p), i18nNames, p.category, ...(p.tags || []), p.flavor, p.description?.slice(0, 300)].join(' '));
}

// Palavras que não identificam produto ("de" casava com "deep" e trazia sérum para "cartas de pokemon").
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'sem', 'por', 'uma', 'um', 'uns', 'umas', 'tem', 'voces',
  'quero', 'qual', 'quanto', 'custa', 'fica', 'frete', 'produto', 'produtos', 'the', 'of', 'and', 'for', 'with', 'want', 'how', 'much']);

export function searchCatalog(products: Product[], query: string, limit = 6): Product[] {
  // "Finoヘアマスク" → "fino" + "ヘアマスク": separa latino de japonês.
  const terms = normalize(query)
    .replace(/([a-z0-9])([\u3040-\u30ff\u4e00-\u9faf])/g, '$1 $2')
    .replace(/([\u3040-\u30ff\u4e00-\u9faf])([a-z0-9])/g, '$1 $2')
    .split(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/)
    .filter((t) => (/^[a-z0-9]+$/.test(t) ? t.length >= 3 && !STOPWORDS.has(t) : t.length >= 2));
  if (!terms.length) return [];
  const scored = visible(products).map((p) => {
    const name = normalize(`${p.name} ${productEnglishName(p)}`);
    const hay = productHaystack(p);
    let score = 0;
    for (const t of terms) {
      if (name.includes(t)) score += 3;
      else if (hay.includes(t)) score += 1;
    }
    return { p, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (b.p.salesCount || 0) - (a.p.salesCount || 0));
  return scored.slice(0, limit).map((x) => x.p);
}

const findProduct = (products: Product[], id: string | undefined) =>
  id ? visible(products).find((p) => p.id === id) : undefined;

function variantFor(p: Product, variantId?: string) {
  const variants = getVariants(p);
  // A IA às vezes manda o nome da variante ("Pequeno") no lugar do id.
  return variants.find((v) => v.id === variantId)
    || variants.find((v) => variantId && normalize(v.label) === normalize(variantId))
    || [...variants].sort((a, b) => a.price - b.price)[0];
}

function describeProduct(p: Product, currency: string) {
  const variants = getVariants(p);
  return {
    id: p.id,
    nome: productEnglishName(p),
    variantes: variants.map((v) => ({
      id: v.id,
      nome: v.label,
      preco: formatPrice(convertYen(effectiveYen(p, v.id), currency), currency),
    })),
    desconto: hasDiscount(p) ? `${p.discountPercent}%` : undefined,
    esgotado: isSoldOut(p) || undefined,
  };
}

// ---------- Cotação de pedido (mesma composição do checkout) ----------

interface QuoteItemInput { produto_id?: string; variante_id?: string; quantidade?: number }

function buildItems(ctx: ToolContext, itens: QuoteItemInput[] | undefined): { items: CartItem[]; unknown: string[] } {
  const unknown: string[] = [];
  const items: CartItem[] = [];
  for (const it of (itens || []).slice(0, 15)) {
    const p = findProduct(ctx.products, it.produto_id);
    if (!p) { unknown.push(String(it.produto_id || '?')); continue; }
    const v = variantFor(p, it.variante_id);
    // Modelos menores às vezes erram o nome do campo ("quantidade_1", "quantidade:").
    const rawQty = it.quantidade ?? Object.entries(it).find(([k]) => /^(quantidade|quantity|qty)/i.test(k))?.[1];
    const quantity = Math.max(1, Math.min(MAX_QTY, Math.round(Number(rawQty) || 1)));
    items.push({ product: p, size: v?.id || 'small', variantLabel: v?.label, quantity });
  }
  return { items, unknown };
}

export function quoteOrder(ctx: ToolContext, args: { itens?: QuoteItemInput[]; usar_carrinho?: boolean; pais?: string; provincia?: string }): ToolResult {
  const country = resolveCountry(args.pais, ctx.country);
  if (!country) {
    return fail('pais_desconhecido', { dica: 'Use o nome do país em português, ex.: Brasil, Portugal, Estados Unidos, Japão.' });
  }
  const fromCart = args.usar_carrinho || !args.itens?.length;
  const { items, unknown } = fromCart ? { items: ctx.cartItems, unknown: [] as string[] } : buildItems(ctx, args.itens);
  if (!items.length) {
    return fail(fromCart ? 'carrinho_vazio' : 'nenhum_produto_valido', unknown.length ? { ids_desconhecidos: unknown } : {});
  }

  const currency = getCurrencyByCountry(country);
  const prefecture = country === 'Japão' ? resolvePrefecture(args.provincia) ?? undefined : undefined;
  const quote = quoteShipping(items, country, { prefecture });

  const paid = items.filter((i) => !i.freeGift);
  const subtotal = paid.reduce((s, i) => s + convertYen(effectiveYen(i.product, i.size), currency) * i.quantity, 0);
  const psQty = paid.reduce((s, i) => (i.product.noPsFee ? s : s + i.quantity), 0);
  const psFee = convertYen(psQty * PS_FEE_YEN_PER_UNIT, currency, true);

  const cfg = getCountryConfig(country);
  const vat = country !== 'Brasil' && country !== 'Japão' ? cfg?.vat || 0 : 0;

  const fmt = (v: number) => formatPrice(v, currency);
  const result: Record<string, unknown> = {
    ok: true,
    pais: country,
    moeda: currency,
    itens: paid.map((i) => ({
      produto_id: i.product.id,
      nome: productEnglishName(i.product),
      variante: i.variantLabel || variantFor(i.product, i.size)?.label,
      quantidade: i.quantity,
      preco_unitario: fmt(convertYen(effectiveYen(i.product, i.size), currency)),
    })),
    subtotal_produtos: fmt(subtotal),
    taxa_servico: psQty ? `${fmt(psFee)} (¥1.000 por unidade — compra assistida no Japão)` : fmt(0),
    peso_total: `${(quote.boxes.totalWeightG / 1000).toFixed(2).replace('.', ',')} kg (com embalagem)`,
  };
  if (unknown.length) result.ids_desconhecidos = unknown;

  if (quote.needsPrefecture) {
    result.frete = 'precisa_da_provincia';
    result.dica = 'No Japão o frete depende da província de entrega. Pergunte a província ao cliente e chame cotar_pedido de novo.';
  } else if (quote.isOverweight) {
    result.frete = `acima_do_limite_de_${MAX_WEIGHT_G / 1000}kg`;
    result.dica = 'Peso acima do limite do correio: oriente a falar com a loja pelo WhatsApp.';
  } else {
    result.opcoes_frete = quote.options.map((o) => o.isConsultar
      ? { servico: o.name, prazo_dias: o.estimatedDays, preco: 'sob consulta' }
      : {
          servico: o.name,
          prazo_dias: o.estimatedDays,
          frete: o.cost === 0 && o.originalCost ? `${fmt(0)} (grátis)` : fmt(o.cost),
          total_com_frete_e_taxa: fmt(subtotal + o.cost + psFee),
        });
    if (country === 'Japão' && !quote.isFreeShipping) {
      result.frete_gratis = `No Japão o frete é grátis a partir de ${formatPrice(JAPAN_FREE_SHIPPING_MIN_YEN, 'JPY')} em produtos.`;
    }
  }
  if (vat > 0) {
    result.imposto_estimado = `${fmt(subtotal * vat)} (estimativa de ${Math.round(vat * 100)}% cobrada pela alfândega do destino, NÃO pela loja)`;
  }
  if (country !== 'Japão') result.aviso_impostos = taxDisclosure(ctx.language).body;
  return json(result);
}

// ---------- Ferramentas ----------

export function runAssistantTool(name: string, rawArgs: string | undefined, ctx: ToolContext): ToolResult {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return fail('argumentos_invalidos');
  }
  const currency = getCurrencyByCountry(ctx.country);

  switch (name) {
    case 'buscar_produtos': {
      const limit = Math.max(1, Math.min(6, Number(args.limite) || 4));
      const found = searchCatalog(ctx.products, String(args.consulta || ''), limit);
      return {
        content: JSON.stringify(found.length
          ? { ok: true, moeda: currency, produtos: found.map((p) => describeProduct(p, currency)) }
          : { ok: true, produtos: [], dica: 'Nada encontrado. Os nomes do catálogo estão em alfabeto latino (ex.: "Fino hair mask", "Biore UV"): se a busca foi em japonês ou com outra grafia, busque de novo com a marca/tipo em inglês ANTES de dizer que não temos. Se ainda assim não houver, ofereça o "Faça seu Pedido".' }),
      };
    }

    case 'cotar_pedido':
      return quoteOrder(ctx, args as Parameters<typeof quoteOrder>[1]);

    case 'ver_carrinho': {
      if (!ctx.cartItems.length) return json({ ok: true, itens: [], vazio: true });
      return quoteOrder(ctx, { usar_carrinho: true });
    }

    case 'converter_moeda': {
      const valor = Number(args.valor);
      const de = String(args.de || '').toUpperCase();
      const para = String(args.para || '').toUpperCase();
      const ok = ['JPY', 'BRL', 'EUR', 'USD'];
      if (!(valor > 0) || !ok.includes(de) || !ok.includes(para)) return fail('use valor > 0 e moedas JPY, BRL, EUR ou USD');
      const yen = de === 'JPY' ? valor : yenFromConverted(valor, de);
      const out = para === 'JPY' ? yen : convertYen(yen, para);
      return json({
        ok: true,
        de: formatPrice(valor, de, true),
        para: formatPrice(out, para, true),
        nota: 'Câmbio do site (o mesmo usado nos preços), atualizado ao vivo.',
      });
    }

    case 'adicionar_ao_carrinho': {
      if (ctx.allowCartChanges === false) {
        return fail('cliente_nao_pediu_para_adicionar', { dica: 'Não adicione sem pedido. Mostre o total e pergunte se o cliente quer que você adicione ao carrinho.' });
      }
      const p = findProduct(ctx.products, String(args.produto_id || ''));
      if (!p) return fail('produto_nao_encontrado', { dica: 'Use buscar_produtos para obter o id correto.' });
      if (isSoldOut(p)) return fail('esgotado');
      const v = variantFor(p, args.variante_id ? String(args.variante_id) : undefined);
      const qty = Math.max(1, Math.min(MAX_QTY, Math.round(Number(args.quantidade) || 1)));
      const size = v?.id || 'small';
      ctx.addToCart(p, size, qty, v?.label);
      // O estado do carrinho só atualiza no próximo render; a cotação seguinte
      // nesta mesma resposta precisa já enxergar o item.
      const existing = ctx.cartItems.find((i) => i.product.id === p.id && i.size === size && !i.freeGift);
      ctx.cartItems = existing
        ? ctx.cartItems.map((i) => (i === existing ? { ...i, quantity: i.quantity + qty } : i))
        : [...ctx.cartItems, { product: p, size, quantity: qty, variantLabel: v?.label }];
      return {
        content: JSON.stringify({
          ok: true,
          adicionado: { nome: productEnglishName(p), variante: v?.label, quantidade: qty, preco_unitario: formatPrice(convertYen(effectiveYen(p, v?.id || 'small'), currency), currency) },
          dica: 'Ofereça finalizar a compra (botão finalizar_compra) ou continuar comprando.',
        }),
        ui: { cartChanged: true, actions: ['finalizar_compra', 'continuar_comprando'] },
      };
    }

    case 'mostrar_opcoes': {
      const ids = Array.isArray(args.produtos) ? args.produtos.map(String).slice(0, 5) : [];
      const products = ids.map((id) => findProduct(ctx.products, id)).filter((p): p is Product => Boolean(p));
      const actions = (Array.isArray(args.acoes) ? args.acoes : [])
        .map(String)
        .filter((a): a is AssistantAction => (ASSISTANT_ACTIONS as string[]).includes(a));
      return { content: JSON.stringify({ ok: true, exibidos: { produtos: products.length, acoes: actions } }), ui: { products, actions } };
    }

    default:
      return fail('ferramenta_desconhecida');
  }
}
