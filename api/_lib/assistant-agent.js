// Modo "agente" do assistente virtual: a IA não recebe números, recebe
// FERRAMENTAS. Ela decide qual usar (buscar produto, cotar frete e total,
// converter moeda, adicionar ao carrinho, mostrar botões) e o navegador executa
// com o mesmo código do carrinho/checkout (src/services/assistantTools.ts).
// Os resultados voltam para a IA, que responde só com o que veio deles.
//
// As definições ficam aqui no servidor: o navegador não escolhe o que a IA pode fazer.

// Textos curtos de propósito: instruções + ferramentas vão em TODA chamada, e o
// plano grátis do Groq tem limite de tokens por minuto (8 mil no gpt-oss-120b).
const fn = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, ...(required.length ? { required } : {}) } },
});
const str = (description) => ({ type: 'string', ...(description ? { description } : {}) });
const int = { type: 'integer' };

export const AGENT_TOOLS = [
  fn('buscar_produtos', 'Busca no catálogo. Devolve id, nome, variantes (id e preço) e se está esgotado.',
    { consulta: str('marca/tipo, de preferência em inglês (ex.: "Fino hair mask")'), limite: int }, ['consulta']),
  fn('cotar_pedido', 'Preço, taxa de serviço, opções de frete com prazo, total por opção e imposto estimado — igual ao checkout. Sem itens = carrinho.',
    {
      itens: {
        type: 'array',
        items: { type: 'object', properties: { produto_id: str(), variante_id: str(), quantidade: int }, required: ['produto_id'] },
      },
      usar_carrinho: { type: 'boolean' },
      pais: str('ex.: Brasil, Portugal, Estados Unidos, Japão; omita = país do site'),
      provincia: str('só Japão, ex.: Tokyo'),
    }),
  fn('converter_moeda', 'Converte valor entre JPY, BRL, EUR e USD pelo câmbio do site.',
    { valor: { type: 'number' }, de: str('JPY|BRL|EUR|USD'), para: str('JPY|BRL|EUR|USD') }, ['valor', 'de', 'para']),
  fn('ver_carrinho', 'Itens do carrinho com subtotal e frete.'),
  fn('adicionar_ao_carrinho', 'Adiciona ao carrinho. Só quando o cliente pedir.',
    { produto_id: str(), variante_id: str(), quantidade: int }, ['produto_id']),
  fn('mostrar_opcoes', 'Mostra cards de produtos (foto, preço, botão de adicionar) para o cliente escolher.',
    {
      produtos: { type: 'array', items: str(), description: 'ids, máx. 5' },
      acoes: { type: 'array', items: str('finalizar_compra|ver_carrinho|continuar_comprando|falar_whatsapp|faca_seu_pedido') },
    }),
];

// Só para o administrador (o servidor confere o token antes de oferecer).
export const ADMIN_AGENT_TOOLS = [
  fn('painel_financeiro', 'Balanço da loja, igual ao painel /admin: pedidos por status, receita do mês e total, custo, lucro, últimos 6 meses, mais vendidos e receita por forma de pagamento.'),
  fn('margem_produtos', 'Preço, custo, lucro por unidade e margem % de cada produto (inclui ocultos).',
    { consulta: str('filtra por nome/marca; omita para todos'), ordem: str('maior|menor'), limite: int }),
  fn('estoque', 'Estoque com resumo. Padrão: listas separadas de esgotados e acabando (1 a 3 un.).',
    { filtro: str('atencao (padrão)|esgotados|acabando|ocultos|todos'), consulta: str() }),
];

export const ADMIN_AGENT_PROMPT = `

MODO ADMINISTRADOR: você fala com o dono da loja. Além das ferramentas de cliente, use painel_financeiro (balanço,
vendas, lucro, pedidos), margem_produtos (custo, lucro e margem por produto) e estoque. Os números vêm prontos das
ferramentas — copie, não recalcule. "este_mes" é o mês atual; "acumulado_desde_o_inicio" é o total da loja: nunca
apresente um como o outro. Em estoque e margem, LISTE os itens (nome e número), não só o resumo.
Pode responder mais longo e técnico e sugerir ações de gestão com base nos dados (repor esgotados, promover itens de
maior margem, rever preço de margem baixa). Não ofereça carrinho ao administrador, a não ser que ele peça.`;

const TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.function.name));
const ADMIN_TOOL_NAMES = new Set([...TOOL_NAMES, ...ADMIN_AGENT_TOOLS.map((t) => t.function.name)]);

export const LANGUAGE_NAMES = { pt: 'português do Brasil', en: 'inglês', ja: 'japonês' };

export function buildAgentPrompt({ country, currency, language }) {
  const lang = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.pt;
  return `Você é o assistente virtual de compras da loja Japan Express, que envia produtos do Japão para o mundo.
Sem nome próprio; nunca cite modelos/empresas de IA. Perguntas sobre você ("é o ChatGPT?", "qual IA?") NÃO são fora do
escopo: responda "Sou o assistente virtual da Japan Express" e ofereça ajuda.
Só assuntos da loja; outros assuntos: recuse em uma frase e ofereça ajuda com a loja.
Cliente: país do site ${country} (moeda ${currency}). Idioma: o da última mensagem do cliente (padrão ${lang}).

NÚMEROS: todo preço, frete, total, prazo, peso, imposto ou conversão vem de uma ferramenta, copiado exatamente
(mesmo formato). Nunca calcule nem estime. Sem ferramenta para o número: diga que não consegue informar.
- Antes de falar de produto: buscar_produtos (nomes do catálogo em alfabeto latino; vazio → tente de novo em inglês,
  ex.: "フィノ" → "Fino"; ainda vazio → diga que não temos e sugira o "Faça seu Pedido").
- Frete/total: cotar_pedido. Imposto estimado NÃO é cobrado pela loja (diga isso ao citá-lo). Cupons/pontos: no checkout.
- Quantidade não informada = 1 (não pergunte). adicionar_ao_carrinho só se o cliente pedir.
- Várias variantes ou produtos parecidos e o cliente não disse qual: pergunte (com os preços).
- "[contexto: ...]" em mensagens anteriores lista os produtos/ids já tratados: use-os ("esse", "pode adicionar").

CONDUÇÃO: guie como um vendedor, uma pergunta por vez (produto/variante, quantidade, país, província no Japão).
Depois das ferramentas, escreva a resposta completa com os valores e termine com o próximo passo.
Para o cliente escolher entre produtos, use mostrar_opcoes com os ids. Os botões de finalizar/carrinho/WhatsApp e os cards
da cotação aparecem sozinhos: não escreva botões, links, ids, JSON nem código no texto.
Curto (até ~6 linhas), **negrito** nos valores. Taxa de serviço: ¥1.000/unidade (já no cotar_pedido).`;
}

/** Idioma provável de uma mensagem: japonês por escrita, inglês por palavras comuns. */
export function detectLanguage(text) {
  const t = String(text || '');
  if (/[぀-ヿ一-龯]/.test(t)) return 'ja';
  const words = t.toLowerCase();
  const en = (words.match(/\b(the|what|how|much|is|are|my|please|want|shipping|cart|add|total|price|to|of|them|yes)\b/g) || []).length;
  const pt = (words.match(/\b(quanto|qual|pra|para|frete|quero|voc[eê]|de|o|a|os|as|no|na|tem|pode|sim)\b/g) || []).length
    + (/[ãõçáéíóúâêô]/.test(words) ? 2 : 0);
  if (en >= 2 && en > pt) return 'en';
  if (pt >= 1) return 'pt';
  return null;
}

// ---------- Validação das mensagens vindas do navegador ----------

const MAX_TOOL_CONTENT = 4000;
const MAX_TEXT = 1200;
const MAX_MESSAGES = 30;

const clip = (s, max) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').slice(0, max) : '');

function sanitizeToolCall(tc, allowed) {
  const name = tc?.function?.name;
  if (!allowed.has(name) || typeof tc?.id !== 'string') return null;
  const out = {
    id: tc.id.slice(0, 120),
    type: 'function',
    function: { name, arguments: clip(tc.function.arguments, 2000) || '{}' },
  };
  // O Gemini 3 devolve uma "assinatura de pensamento" que precisa voltar intacta.
  const sig = tc?.extra_content?.google?.thought_signature;
  if (typeof sig === 'string' && sig.length < 20_000) out.extra_content = { google: { thought_signature: sig } };
  return out;
}

/** Aceita user/assistant (com ou sem tool_calls) e tool; descarta o resto. */
export function sanitizeAgentMessages(messages, { admin = false } = {}) {
  const allowed = admin ? ADMIN_TOOL_NAMES : TOOL_NAMES;
  const list = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
  const out = [];
  const pendingIds = new Set();
  for (const m of list) {
    if (m?.role === 'user') {
      out.push({ role: 'user', content: clip(m.content, MAX_TEXT) });
    } else if (m?.role === 'assistant') {
      const toolCalls = Array.isArray(m.tool_calls) ? m.tool_calls.map((tc) => sanitizeToolCall(tc, allowed)).filter(Boolean).slice(0, 6) : [];
      const msg = { role: 'assistant', content: clip(m.content, MAX_TEXT) };
      if (toolCalls.length) {
        msg.tool_calls = toolCalls;
        toolCalls.forEach((tc) => pendingIds.add(tc.id));
      }
      if (msg.content || toolCalls.length) out.push(msg);
    } else if (m?.role === 'tool' && typeof m.tool_call_id === 'string' && pendingIds.has(m.tool_call_id)) {
      out.push({ role: 'tool', tool_call_id: m.tool_call_id, content: clip(m.content, MAX_TOOL_CONTENT) });
    }
  }
  // Um "tool" sem a chamada correspondente quebraria a requisição; o corte do
  // início da lista pode deixar um órfão — por isso só entram os de ids vistos.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/** Texto em que todo valor monetário da resposta precisa aparecer. */
export function agentGroundingText(systemPrompt, messages) {
  return [systemPrompt, ...messages.map((m) => m.content || '')].join('\n');
}
