import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types';
import type { AgentReply } from '@/services/qwenService';
import { cleanAgentText, runAgentTurn } from './assistantAgent';
import type { ToolContext } from './assistantTools';

const fino = { id: 'fino', name: 'Fino Hair Mask', description: '', category: 'cosmeticos', prices: { small: 1600, large: 0 }, image: '', flavor: '' } as Product;
const call = (id: string, name: string, args: object) => ({ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } });
const locale = { country: 'Brasil', currencyCode: 'BRL', language: 'pt' as const };
const ctxFor = (): ToolContext => ({ products: [fino], cartItems: [], country: 'Brasil', language: 'pt', addToCart: vi.fn() });

const seen: string[][] = [];
const scripted = (replies: Array<AgentReply | null>) => vi.fn(async (messages: Array<{ role: string }>) => {
  seen.push(messages.map((m) => m.role)); // cópia: a lista continua crescendo depois
  return replies.shift() ?? null;
});

describe('cleanAgentText', () => {
  it('tira botões escritos à mão e JSON, e transforma em botões de verdade', () => {
    const raw = [
      'Total: **R$ 182 (¥ 4.900)**',
      '',
      '**Próximos passos:**',
      '- **[Finalizar compra]**',
      '- **[Continuar comprando]**',
      '(Use os botões acima.)',
      '```json',
      '{ "mostrar_opcoes": { "acoes": ["falar_whatsapp"] } }',
      '```',
    ].join('\n');
    const out = cleanAgentText(raw);
    expect(out.text).toBe('Total: **R$ 182 (¥ 4.900)**');
    expect(out.actions).toEqual(expect.arrayContaining(['finalizar_compra', 'continuar_comprando', 'falar_whatsapp']));
  });

  it('tira sobras de JSON e títulos vazios no fim, em pt e ja', () => {
    expect(cleanAgentText('Total **R$ 182**.\n\n*Escolha uma das opções abaixo para continuar:*\n\n}').text).toBe('Total **R$ 182**.');
    expect(cleanAgentText('合計 **¥ 3.550**\n\n【次のステップ】\n\n(ボタンを表示)').text).toBe('合計 **¥ 3.550**');
  });

  it('troca a lista "Próximo passo:" escrita à mão pelos botões', () => {
    const raw = 'Total: **¥ 3.550**\n\nPróximo passo:  \n- **Adicionar ao carrinho**  \n- **Ver carrinho**  \n- **Falar WhatsApp** (para dúvidas)';
    const out = cleanAgentText(raw);
    expect(out.text).toBe('Total: **¥ 3.550**');
    expect(out.actions).toEqual(['ver_carrinho', 'falar_whatsapp']);
  });

  it('mantém a pergunta final ao cliente', () => {
    const raw = 'Frete: **R$ 92**.\n\nQual dessas opções de frete você prefere?';
    expect(cleanAgentText(raw).text).toBe(raw);
  });

  it('não mexe em texto normal com listas', () => {
    const raw = 'Opções de frete:\n1. **E-Light** – 20-40 dias – **R$ 92**\n2. **EMS** – 18 dias – **R$ 156**';
    expect(cleanAgentText(raw)).toEqual({ text: raw, actions: [] });
  });
});

describe('runAgentTurn', () => {
  it('usa o texto escrito junto com as ferramentas e termina quando só faltam os botões', async () => {
    const ask = scripted([
      { text: '', toolCalls: [call('1', 'buscar_produtos', { consulta: 'fino' })] },
      { text: 'A máscara Fino sai por **R$ 60**.', toolCalls: [call('2', 'mostrar_opcoes', { produtos: ['fino'], acoes: ['finalizar_compra'] })] },
    ]);
    const out = await runAgentTurn({ convo: [{ role: 'user', content: 'fino?' }], locale, ctx: ctxFor(), ask });
    expect(out.ok).toBe(true);
    expect(out.text).toBe('A máscara Fino sai por **R$ 60**.');
    expect(out.products.map((p) => p.id)).toEqual(['fino']);
    expect(out.actions).toEqual(['finalizar_compra']);
    expect(out.context).toContain('fino');
    // A segunda rodada recebeu o resultado da busca.
    expect(seen[1]).toEqual(['user', 'assistant', 'tool']);
    // Texto + só mostrar_opcoes encerra a resposta, sem rodada extra.
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('põe os botões de próximo passo sozinho (sem chamada extra da IA)', async () => {
    const nothing = scripted([
      { text: '', toolCalls: [call('1', 'buscar_produtos', { consulta: 'pokemon' })] },
      { text: 'Não temos cartas de Pokémon agora.', toolCalls: [] },
    ]);
    const out = await runAgentTurn({ convo: [{ role: 'user', content: 'tem pokemon?' }], locale, ctx: ctxFor(), ask: nothing });
    expect(out.actions).toEqual(['faca_seu_pedido', 'falar_whatsapp']);

    const quote = scripted([
      { text: '', toolCalls: [call('1', 'cotar_pedido', { itens: [{ produto_id: 'fino' }] })] },
      { text: 'Fica **R$ 182**.', toolCalls: [] },
    ]);
    const q = await runAgentTurn({ convo: [{ role: 'user', content: 'quanto fica?' }], locale, ctx: ctxFor(), ask: quote });
    expect(q.products.map((p) => p.id)).toEqual(['fino']);
    expect(q.actions).toEqual(['continuar_comprando']);
  });

  it('"quero finalizar" com carrinho cheio mostra o botão mesmo sem ferramentas', async () => {
    const ctx = { ...ctxFor(), cartItems: [{ product: fino, size: 'small', quantity: 1 }] };
    const out = await runAgentTurn({ convo: [{ role: 'user', content: 'quero finalizar' }], locale, ctx, ask: scripted([{ text: 'Perfeito! É só clicar abaixo.', toolCalls: [] }]) });
    expect(out.actions).toEqual(['finalizar_compra', 'ver_carrinho']);

    // Mesmo quando a IA refaz a cotação (que só sugeriria "continuar comprando").
    const ctx2 = { ...ctxFor(), cartItems: [{ product: fino, size: 'small', quantity: 1 }] };
    const requote = scripted([
      { text: '', toolCalls: [call('1', 'cotar_pedido', { itens: [{ produto_id: 'fino' }] })] },
      { text: 'Total **R$ 182**.', toolCalls: [] },
    ]);
    const out2 = await runAgentTurn({ convo: [{ role: 'user', content: 'quero finalizar' }], locale, ctx: ctx2, ask: requote });
    expect(out2.actions.slice(0, 2)).toEqual(['finalizar_compra', 'ver_carrinho']);
  });

  it('IA fora do ar sem nada feito → ok=false (o chat usa as regras locais)', async () => {
    const out = await runAgentTurn({ convo: [{ role: 'user', content: 'oi' }], locale, ctx: ctxFor(), ask: scripted([null]) });
    expect(out.ok).toBe(false);
  });

  it('não deixa a IA adicionar ao carrinho quando o cliente só perguntou o preço', async () => {
    const ctx = ctxFor();
    const ask = scripted([
      { text: '', toolCalls: [call('1', 'adicionar_ao_carrinho', { produto_id: 'fino', quantidade: 2 })] },
      { text: 'Quer que eu coloque no carrinho?', toolCalls: [] },
    ]);
    const out = await runAgentTurn({ convo: [{ role: 'user', content: 'quanto fica 2 fino com frete?' }], locale, ctx, ask });
    expect(ctx.addToCart).not.toHaveBeenCalled();
    expect(out.cartChanged).toBe(false);

    // "sim" respondendo à pergunta do carrinho libera.
    const ctx2 = ctxFor();
    const ask2 = scripted([{ text: '', toolCalls: [call('1', 'adicionar_ao_carrinho', { produto_id: 'fino' })] }, { text: 'Pronto!', toolCalls: [] }]);
    await runAgentTurn({
      convo: [{ role: 'user', content: 'quanto fica?' }, { role: 'assistant', content: 'Quer que eu coloque no carrinho?' }, { role: 'user', content: 'sim' }],
      locale, ctx: ctx2, ask: ask2,
    });
    expect(ctx2.addToCart).toHaveBeenCalledTimes(1);
  });

  it('se a IA cai depois de adicionar ao carrinho, não devolve para as regras locais (adicionariam de novo)', async () => {
    const ctx = ctxFor();
    const ask = scripted([{ text: '', toolCalls: [call('1', 'adicionar_ao_carrinho', { produto_id: 'fino' })] }, null]);
    const out = await runAgentTurn({ convo: [{ role: 'user', content: 'adiciona' }], locale, ctx, ask });
    expect(ctx.addToCart).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ ok: true, cartChanged: true });
  });
});
