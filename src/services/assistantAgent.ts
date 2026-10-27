/**
 * Uma pergunta do cliente → uma resposta do agente. A IA pede ferramentas,
 * este loop as executa (assistantTools.ts) e devolve os resultados, até a IA
 * escrever a resposta final. Usado pelo chat e pelo teste com a IA real.
 */
import type { Product } from '@/types';
import type { AgentLocale, AgentMsg, AgentReply } from '@/services/qwenService';
import { cartRequested, runAssistantTool, type AssistantAction, type ToolContext } from '@/services/assistantTools';
import { ADMIN_TOOL_NAMES, runAdminTool, type AdminToolContext } from '@/services/assistantAdminTools';

export const AGENT_MAX_ROUNDS = 6;
/** Tempo máximo de uma resposta; passou disso, o chat segue com o que tem (ou as regras locais). */
export const AGENT_DEADLINE_MS = 45_000;
const MAX_CONTEXT_CHARS = 1500;

export interface AgentTurnResult {
  /** false = a IA não respondeu (o chat usa as regras locais). */
  ok: boolean;
  text: string;
  products: Product[];
  actions: AssistantAction[];
  cartChanged: boolean;
  /** Resumo dos produtos/cotação desta resposta, para a próxima pergunta lembrar. */
  context: string;
}

interface RunAgentTurnOptions {
  convo: AgentMsg[];
  locale: AgentLocale;
  ctx: ToolContext;
  ask: (messages: AgentMsg[], locale: AgentLocale) => Promise<AgentReply | null>;
  onTool?: (name: string) => void;
  deadlineMs?: number;
  /** Só para teste: substitui a leitura do painel /admin. */
  fetchDashboard?: AdminToolContext['fetchDashboard'];
}

type ProductRef = { nome: string; variantes?: string };

/** Lembra os produtos e a cotação vistos nos resultados das ferramentas. */
function collectRefs(name: string, content: string, refs: Map<string, ProductRef>, quotes: string[]) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    return;
  }
  if (name === 'buscar_produtos' && Array.isArray(data.produtos)) {
    for (const p of data.produtos as Array<{ id: string; nome: string; variantes?: Array<{ id: string; nome: string }> }>) {
      refs.set(p.id, { nome: p.nome, variantes: p.variantes?.map((v) => `${v.id}=${v.nome}`).join(', ') });
    }
  }
  if ((name === 'cotar_pedido' || name === 'ver_carrinho') && Array.isArray(data.itens) && data.itens.length) {
    const itens = data.itens as Array<{ produto_id: string; nome: string; quantidade: number; variante?: string }>;
    for (const i of itens) if (!refs.has(i.produto_id)) refs.set(i.produto_id, { nome: i.nome });
    quotes.push(`${name === 'ver_carrinho' ? 'carrinho' : 'cotação'} para ${data.pais}: ${itens.map((i) => `${i.produto_id}${i.variante ? ` (${i.variante})` : ''} × ${i.quantidade}`).join(', ')}`);
  }
  if (name === 'adicionar_ao_carrinho' && data.ok) quotes.push('itens adicionados ao carrinho nesta resposta');
}

function buildContext(refs: Map<string, ProductRef>, quotes: string[]): string {
  if (!refs.size && !quotes.length) return '';
  const parts = [...refs].map(([id, r]) => `${r.nome} (id: ${id}${r.variantes ? `; variantes: ${r.variantes}` : ''})`);
  const text = `[contexto: produtos: ${parts.join(' | ') || '-'}${quotes.length ? ` · ${quotes[quotes.length - 1]}` : ''}]`;
  return text.slice(0, MAX_CONTEXT_CHARS);
}

// Ações que modelos menores às vezes escrevem no texto em vez de chamar mostrar_opcoes.
const ACTION_HINTS: Array<[AssistantAction, RegExp]> = [
  ['finalizar_compra', /finalizar|checkout|concluir a compra|購入手続/i],
  ['ver_carrinho', /ver (o )?carrinho|view cart|カートを見る/i],
  ['continuar_comprando', /continuar comprando|keep shopping|continue shopping|買い物を続/i],
  ['falar_whatsapp', /whatsapp/i],
  ['faca_seu_pedido', /fa(ç|c|z)(a|er) seu pedido|custom order|取り寄せ/i],
];
const ACTION_IDS = /\b(finalizar_compra|ver_carrinho|continuar_comprando|falar_whatsapp|faca_seu_pedido|fazer_seu_pedido|mostrar_opcoes)\b/;

/**
 * Limpa o texto da IA: tira blocos de código/JSON e "botões" escritos à mão
 * (o chat mostra botões de verdade) e devolve as ações que eles indicavam.
 */
export function cleanAgentText(raw: string): { text: string; actions: AssistantAction[] } {
  const actions: AssistantAction[] = [];
  const noteAction = (line: string) => {
    for (const [action, re] of ACTION_HINTS) if (re.test(line) && !actions.includes(action)) actions.push(action);
  };
  const withoutCode = raw.replace(/```[\s\S]*?(```|$)/g, (block) => {
    if (ACTION_IDS.test(block)) noteAction(block.replace(/_/g, ' '));
    return '';
  });
  // Seção "Próximos passos:" com itens curtos = botões escritos à mão.
  const lines = withoutCode.split('\n');
  const stepsAt = lines.findIndex((l) => /pr(ó|o)xim[oa]s? passos?|next steps?|次のステップ/i.test(l) && !l.includes('?'));
  if (stepsAt >= 0) {
    const rest = lines.slice(stepsAt + 1).filter((l) => l.trim());
    const isStepItem = (l: string) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l) && l.length < 90;
    if (rest.length && rest.every(isStepItem)) {
      rest.forEach(noteAction);
      lines.splice(stepsAt);
    }
  }
  const kept = lines.filter((line) => {
    const bare = line.replace(/\uFE0F\u20E3/g, '').replace(/[*_`>\s\-•\d.)]/g, '');
    const fakeButton = /^\s*(?:[-*•]|\d+[.)])?\s*\**\[[^\]]+\]\**/.test(line) || ACTION_IDS.test(line);
    if (fakeButton) { noteAction(line.replace(/_/g, ' ')); return false; }
    if (/bot(õ|o)es acima|buttons above|上のボタン|ボタンを表示|\(show buttons\)/i.test(line)) return false;
    if (/^\s*[{}[\](),]+\s*$/.test(line)) return false; // sobra de JSON
    return bare.length > 0 || line.trim() === '';
  });
  // Título/chamada que ficou sem conteúdo no fim (ex.: "**Próximos passos**", "【次のステップ】").
  const danglingHeading = (line: string) =>
    (!line.includes('?') && /^\s*([*_]+[^*_\n]{1,70}[*_:]+|[^\n]{1,70}:)\s*$/.test(line)
      && /passos|steps|ステップ|op(ç|c)(õ|o)es|abaixo|below/i.test(line))
    || /^\s*【[^】]*】\s*$/.test(line);
  while (kept.length && (!kept[kept.length - 1].trim() || danglingHeading(kept[kept.length - 1]))) kept.pop();
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), actions };
}

export async function runAgentTurn({ convo, locale, ctx, ask, onTool, deadlineMs = AGENT_DEADLINE_MS, fetchDashboard }: RunAgentTurnOptions): Promise<AgentTurnResult> {
  const startedAt = Date.now();
  const messages = [...convo];
  const lastUser = [...convo].reverse().find((m) => m.role === 'user')?.content || '';
  const lastAssistant = [...convo].reverse().find((m) => m.role === 'assistant' && m.content)?.content || '';
  ctx.allowCartChanges = cartRequested(lastUser, lastAssistant);
  const pieces: string[] = [];
  const products: Product[] = [];
  const actions: AssistantAction[] = [];
  const refs = new Map<string, ProductRef>();
  const quotes: string[] = [];
  let cartChanged = false;

  const quotedIds: string[] = [];
  let searchedNothing = false;
  let quotedCart = false;
  const result = (ok: boolean): AgentTurnResult => {
    const cleaned = cleanAgentText(pieces.join('\n\n'));
    for (const a of cleaned.actions) if (!actions.includes(a)) actions.push(a);
    // Botões de próximo passo sem a IA precisar de uma chamada só para eles.
    const auto: AssistantAction[] = cartChanged || quotedCart ? ['finalizar_compra', 'continuar_comprando']
      : quotedIds.length ? ['continuar_comprando']
        : searchedNothing && !products.length ? ['faca_seu_pedido', 'falar_whatsapp'] : [];
    for (const a of auto) if (!actions.includes(a)) actions.push(a);
    // "Quero finalizar" com carrinho cheio: o botão aparece mesmo se a IA não usou ferramentas.
    if (ctx.cartItems.length && /finaliz|fechar (o )?pedido|checkout|pagar|購入手続|会計/i.test(lastUser)) {
      for (const a of ['ver_carrinho', 'finalizar_compra'] as AssistantAction[]) {
        if (!actions.includes(a)) actions.unshift(a);
      }
    }
    // Sem cards escolhidos pela IA: mostra os da cotação, que têm o botão de adicionar.
    // (Não os da busca: ela pode trazer itens parecidos que a IA descartou.)
    if (!products.length) {
      for (const id of quotedIds) {
        const p = ctx.products.find((x) => x.id === id && !x.hidden);
        if (p && !products.includes(p)) products.push(p);
      }
    }
    return { ok, text: cleaned.text, products: products.slice(0, 5), actions, cartChanged, context: buildContext(refs, quotes) };
  };

  for (let round = 0; round < AGENT_MAX_ROUNDS && Date.now() - startedAt < deadlineMs; round++) {
    const reply = await ask(messages, locale);
    if (!reply) break;
    // O texto pode vir junto com as ferramentas, em partes; a resposta é a soma.
    const piece = reply.text.split('|||')[0].trim();
    if (piece) pieces.push(piece);
    if (!reply.toolCalls.length) {
      if (pieces.length || products.length || actions.length) return result(true);
      break;
    }
    messages.push({ role: 'assistant', content: reply.text, tool_calls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      onTool?.(call.function.name);
      const out = ADMIN_TOOL_NAMES.has(call.function.name)
        ? await runAdminTool(call.function.name, call.function.arguments, { products: ctx.adminProducts ?? ctx.products, isAdmin: Boolean(ctx.isAdmin), fetchDashboard })
        : runAssistantTool(call.function.name, call.function.arguments, ctx);
      for (const p of out.ui?.products || []) if (!products.some((s) => s.id === p.id)) products.push(p);
      for (const a of out.ui?.actions || []) if (!actions.includes(a)) actions.push(a);
      if (out.ui?.cartChanged) cartChanged = true;
      collectRefs(call.function.name, out.content, refs, quotes);
      try {
        const data = JSON.parse(out.content);
        if (call.function.name === 'cotar_pedido' && Array.isArray(data.itens)) quotedIds.push(...data.itens.map((i: { produto_id: string }) => i.produto_id));
        if ((call.function.name === 'ver_carrinho' || (call.function.name === 'cotar_pedido' && /usar_carrinho"\s*:\s*true|^\{\s*\}$/.test(call.function.arguments || '{}'))) && data.ok && data.itens?.length) quotedCart = true;
        if (call.function.name === 'buscar_produtos' && Array.isArray(data.produtos) && !data.produtos.length) searchedNothing = true;
        if (call.function.name === 'buscar_produtos' && data.produtos?.length) searchedNothing = false;
      } catch { /* resultado sem JSON */ }
      messages.push({ role: 'tool', tool_call_id: call.id, content: out.content });
    }
    // Texto + só botões/cards = resposta pronta. Outra rodada só repetiria o
    // texto (visto no teste real) e gastaria uma chamada.
    if (piece && reply.toolCalls.every((c) => c.function.name === 'mostrar_opcoes')) return result(true);
  }
  // A IA parou no meio: ok só se já mexeu no carrinho (as regras locais
  // adicionariam de novo) ou se já tinha algo a mostrar.
  return result(cartChanged || pieces.length > 0);
}
