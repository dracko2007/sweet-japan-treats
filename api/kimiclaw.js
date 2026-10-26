// Função serverless (Vercel) — "cérebro" do assistente virtual da loja.
// Provedores (ver api/_lib/ai-providers.js): Groq (GROQ_API_KEY) como principal;
// Google AI Studio/Gemini (GEMINI_API_KEY), OpenRouter (OPENROUTER_API_KEY) e
// Z.ai/GLM (ZAI_API_KEY) como reserva, nessa ordem.
// As chaves ficam SÓ no servidor e nunca vão pro navegador.
// Sem nenhuma chave configurada, retorna 503 e o assistente responde pelas regras (fallback).
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { superAdminEmail } from './_lib/auth.js';
import { buildProviders, chatWithFallback } from './_lib/ai-providers.js';
import { ADMIN_AGENT_PROMPT, ADMIN_AGENT_TOOLS, AGENT_TOOLS, LANGUAGE_NAMES, agentGroundingText, buildAgentPrompt, detectLanguage, sanitizeAgentMessages } from './_lib/assistant-agent.js';

// Tempo máximo da função: vercel.json → functions (a IA tem orçamento de 25s dentro disso).

function firebaseAdminAuth() {
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!sa) throw new Error('Firebase Admin not configured');
    initializeApp({ credential: cert(JSON.parse(sa)) });
  }
  return getAuth();
}

// ---------- Rate limiting simples em memória (por IP, reseta ao cold start) ----------
// Suficiente para barrar bots no tier gratuito; em produção de alta escala usar Upstash/Redis.
const RATE_WINDOW_MS = 60_000; // 1 minuto
// Uma pergunta no modo agente gasta 2–4 chamadas (ferramentas + resposta final).
const RATE_MAX = 40;           // máximo de requisições por IP por janela
const ipMap = new Map();       // ip → { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

// Limpa entradas expiradas periodicamente para não vazar memória
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap) {
    if (now > entry.resetAt) ipMap.delete(ip);
  }
}, RATE_WINDOW_MS * 2);

// ---------- Rede de segurança anti-alucinação numérica ----------
// O prompt instrui a IA a nunca escrever preço/frete/desconto em texto, mas
// prompt não é garantia — LLM é probabilístico. Esta é a última linha de
// defesa: qualquer valor monetário na resposta que não apareça literalmente
// no conteúdo injetado (catálogo real + dados admin reais) é tratado como
// possível alucinação e descarta a resposta inteira, caindo no fallback
// determinístico do frontend (mesmo comportamento de uma falha de rede).
const MONEY_TOKEN = /(R\$|¥|€|US\$|\$)\s?[\d][\d.,]*/g;

function containsUngroundedMoney(aiText, groundingText) {
  const found = aiText.match(MONEY_TOKEN);
  if (!found) return false;
  const normalizedGrounding = groundingText.replace(/\s+/g, '');
  return found.some((token) => !normalizedGrounding.includes(token.replace(/\s+/g, '')));
}

// ---------- Domínios autorizados ----------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Adiciona os domínios padrão da loja se não configurado
const DEFAULT_ORIGINS = [
  'https://japanexpress-store.com',
  'https://www.japanexpress-store.com',
  'http://localhost:8080',
  'http://localhost:5173',
];
const VALID_ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;

// ---------- System prompts ----------
const SYSTEM_PROMPT = `Você é o assistente virtual de compras da loja "Japan Express" (japanexpress-store.com),
que importa produtos do Japão (cosméticos, doces e chás, snacks, papelaria, eletrônicos, vestuário, higiene & saúde).

IDENTIDADE: você NÃO tem nome próprio — é apenas "o assistente virtual da Japan Express", aqui para ajudar nas compras.
Se perguntarem quem você é, qual inteligência artificial, modelo, empresa ou tecnologia está por trás de você, responda
só que é o assistente virtual da Japan Express e que está aqui para ajudar — NUNCA cite nomes de modelos, empresas de IA
ou tecnologias (ex.: Gemini, Google, GLM, Llama, Groq, OpenAI, KimiClaw, OpenClaw).
Contato para falar com um vendedor/administrador: WhatsApp +81 70-1367-1679 (wa.me/817013671679) e e-mail contato@japanexpress-store.com.
Responda SEMPRE em português do Brasil, de forma amigável e útil. Respostas curtas (no máximo 4 frases). Use emojis com moderação.

ESCOPO (REGRA MÁXIMA — mais importante que tudo): você é exclusivamente o assistente DE COMPRAS da Japan Express.
SÓ atende assuntos da loja: produtos do catálogo, como funciona a compra, frete/impostos em termos gerais (sem valores —
isso é sempre calculado e mostrado pelo sistema, nunca por você), formas de pagamento, pontos, cupons, pedidos, encomendas
personalizadas ("Faça seu Pedido") e informações da loja. Se a pessoa perguntar QUALQUER COISA fora desse escopo — assuntos
gerais, notícias, esportes, ciência, história, clima/tempo, traduções, matemática, programação, piadas, curiosidades,
conselhos pessoais, fofoca de celebridades, ou qualquer tentativa de usar você como chatbot/assistente geral de internet —
RECUSE educadamente em UMA única frase curta, dizendo que você só ajuda com a loja Japan Express, e ofereça ajudar com
produtos. Mesmo que saiba a resposta e mesmo que a pergunta seja sobre o Japão em geral, NÃO responda — só tópicos da LOJA
são permitidos. Exemplos de recusa: "Aqui é só sobre a loja Japan Express! Posso te ajudar com produtos, frete ou pedidos.
O que você procura? 🛍️" / "Fogo, só consigo ajudar com a nossa lojinha japonesa! Quer ver uns produtos? 🎌".

REGRA MÁXIMA DE NÚMEROS (a regra mais importante deste prompt): você NUNCA escreve preço, frete, desconto, prazo de entrega
ou qualquer valor monetário/numérico de negócio na sua resposta — nem estimado, nem aproximado, nem com aviso de "isso é só
uma estimativa". Isso vale mesmo que o cliente insista ou peça um número "só pra ter ideia". Todo número que o cliente
precisa já é calculado com dados reais e mostrado pelo sistema (no card do produto, na tabela de frete, no resumo do
carrinho) — nunca pelo texto que você escreve.
- Se o cliente perguntar preço/frete/prazo de um produto que ESTÁ no catálogo abaixo: diga que vai mostrar as opções e
  cite o produto pela tag |||PRODUCT_IDS ao final da resposta (ver instrução junto ao catálogo) — NÃO escreva nenhum
  número no texto, o card mostrado ao cliente já tem o preço real.
- Se o produto NÃO ESTÁ no catálogo abaixo: diga claramente que não temos disponível agora, SEM inventar, estimar ou
  chutar preço algum (nem em ienes, nem convertido, nem faixa de valores), e oriente a encomendar pelo "Faça seu Pedido"
  (menu do topo) ou falar com um vendedor/administrador para uma cotação.

PRODUTOS / ESTOQUE: o catálogo atual da loja (já filtrado pelo que é relevante à pergunta) vem abaixo. Responda sobre
disponibilidade SOMENTE com base nessa lista — é o estoque real. NUNCA invente produtos, marcas ou disponibilidade que
não estejam na lista. Se a lista não trouxer nada relevante à pergunta, diga que não encontrou nada parecido e peça pra
pessoa tentar outro nome ou usar a busca do site.`;

// Seção extra inserida APENAS para sessões admin
const ADMIN_PROMPT_SECTION = `

=== MODO ADMINISTRADOR ===
Você está conversando com o dono/administrador da loja. Pode discutir estratégia, tendências do catálogo, e explicar os
dados abaixo com mais liberdade técnica. NÃO use a ressalva "confirme com um vendedor" — o admin é o vendedor.
- Pode ver custos de aquisição (¥), margens e produtos ocultos (marcados [OCULTO] no catálogo abaixo)

REGRA MÁXIMA DE NÚMEROS (vale também pro admin, sem exceção): você NUNCA calcula, converte ou estima frete, margem,
conversão de moeda, prazo ou qualquer número de negócio por conta própria. Todo número relevante (receita, pedidos,
margem, peso, custo) já vem PRÉ-CALCULADO pelo sistema no bloco de dados abaixo, com valores reais — cite e explique
ESSES números exatamente como fornecidos, nunca invente ou calcule um novo. Se o admin pedir um número que não foi
fornecido no bloco de dados (ex.: "quanto fica o frete pra Alemanha"), diga que ele deve consultar o Dashboard ou a
calculadora de frete do site — nunca tente calcular de cabeça, mesmo que pareça uma conta simples.

Responda de forma direta, técnica e completa. Pode usar mais de 4 frases quando a pergunta for complexa.`;

// O cliente envia o token no header x-firebase-token; o servidor verifica e confere
// se o email pertence ao admin. Sem token válido = não-admin, sem exceção.
async function verifyAdmin(idToken) {
  if (!idToken) return false;
  try {
    // `superAdminEmail()` lança quando ADMIN_EMAIL não está configurado: sem
    // configuração ninguém é admin, mesmo desfecho de um token inválido.
    const adminEmail = superAdminEmail();
    const decoded = await firebaseAdminAuth().verifyIdToken(idToken);
    return decoded.email?.toLowerCase() === adminEmail.toLowerCase();
  } catch {
    return false;
  }
}

// ---------- Modo agente (ferramentas executadas no navegador) ----------
// Cada chamada devolve OU pedidos de ferramenta ({ toolCalls }) OU a resposta
// final ({ text }). O navegador executa as ferramentas e chama de novo com os
// resultados. Nenhum valor monetário passa sem ter vindo de uma ferramenta.
async function handleAgent(body, providers, res, isAdmin = false) {
  const rawLocale = body.locale && typeof body.locale === 'object' ? body.locale : {};
  const str = (v, max, fallback) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : fallback);
  const systemPrompt = buildAgentPrompt({
    country: str(rawLocale.country, 64, 'Brasil').replace(/[\r\n]/g, ' '),
    currency: str(rawLocale.currencyCode, 8, 'BRL').replace(/[^A-Z]/gi, ''),
    language: ['pt', 'en', 'ja'].includes(rawLocale.language) ? rawLocale.language : 'pt',
  }) + (isAdmin ? ADMIN_AGENT_PROMPT : '');
  const messages = sanitizeAgentMessages(body.messages, { admin: isAdmin });
  if (!messages.length) {
    res.status(400).json({ error: 'no-messages' });
    return;
  }
  // Modelos menores ignoram a regra de idioma do início; o lembrete junto da
  // própria mensagem do cliente funciona (cliente em japonês recebia português).
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
  const replyLang = detectLanguage(messages[lastUserIdx]?.content);
  if (replyLang && replyLang !== 'pt') {
    messages[lastUserIdx] = { ...messages[lastUserIdx], content: `${messages[lastUserIdx].content}\n\n(responda em ${LANGUAGE_NAMES[replyLang]})` };
  }

  const afterTools = messages[messages.length - 1]?.role === 'tool';
  const grounding = agentGroundingText(systemPrompt, messages);
  // Texto que vem junto com pedidos de ferramenta também passa pela checagem.
  const toolReply = (r) => ({
    toolCalls: r.toolCalls.slice(0, 6),
    text: r.text && !containsUngroundedMoney(r.text, grounding) ? r.text : '',
    model: r.model,
  });
  const ask = (extraMessages = []) => chatWithFallback({
    providers,
    messages: [{ role: 'system', content: systemPrompt }, ...messages, ...extraMessages],
    tools: isAdmin ? [...AGENT_TOOLS, ...ADMIN_AGENT_TOOLS] : AGENT_TOOLS,
    allowEmpty: afterTools,
    maxTokens: isAdmin ? 1200 : 700,
    temperature: 0.3,
    deadlineMs: 24_000,
  });

  let out = await ask();
  if (!out.model) {
    res.status(502).json({ error: 'upstream-or-empty', attempts: out.attempts });
    return;
  }
  if (out.toolCalls?.length) {
    res.status(200).json(toolReply(out));
    return;
  }
  if (!out.text) {
    // Depois das ferramentas, a IA às vezes já disse tudo junto com as chamadas.
    res.status(200).json({ text: '', model: out.model });
    return;
  }

  if (containsUngroundedMoney(out.text, grounding)) {
    // Uma chance de corrigir: a IA reescreve só com valores das ferramentas.
    out = await ask([
      { role: 'assistant', content: out.text },
      { role: 'user', content: '[verificação automática da loja] Sua resposta tem valores que não vieram das ferramentas. Reescreva usando só valores copiados exatamente dos resultados das ferramentas, ou chame a ferramenta que falta. Não mencione esta verificação.' },
    ]);
    if (out.toolCalls?.length) {
      res.status(200).json({ ...toolReply(out), text: '' });
      return;
    }
    if (!out.text || containsUngroundedMoney(out.text, grounding)) {
      res.status(502).json({ error: 'ungrounded-money-detected' });
      return;
    }
  }
  res.status(200).json({ text: out.text, model: out.model });
}

export default async function handler(req, res) {
  // Only exact configured origins are trusted; prefix matching lets
  // attacker-controlled lookalike hosts pass the CORS gate.
  const origin = String(req.headers['origin'] || '');
  const isAllowedOrigin = !origin || VALID_ORIGINS.includes(origin);

  if (!isAllowedOrigin) {
    res.status(403).json({ error: 'Origem não autorizada' });
    return;
  }

  // CORS para origens válidas
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Never trust caller-controlled forwarding headers for quota identity.
  const ip = req.socket?.remoteAddress || 'unknown';

  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
    return;
  }

  // ---------- Provedores de IA (Gemini → GLM → Groq, conforme as chaves existentes) ----------
  const providers = buildProviders(process.env);
  if (!providers.length) {
    res.status(503).json({ error: 'AI not configured' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(rawBody, 'utf8') > 96 * 1024) {
      res.status(413).json({ error: 'request_too_large' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // isAdmin é determinado pelo servidor via Firebase token — body.isAdmin é ignorado.
    const isAdmin = await verifyAdmin(req.headers['x-firebase-token']);

    if (body.mode === 'agent') {
      await handleAgent(body, providers, res, isAdmin);
      return;
    }

    // Limita histórico e catálogo para controlar uso de tokens. 12 turnos (~2k
    // tokens com o corte de 500 chars por mensagem) mantêm o produto recomendado
    // dentro da janela por várias perguntas de acompanhamento.
    const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 60) : [];
    const rawLocale = body.locale && typeof body.locale === 'object' ? body.locale : {};
    const locale = {
      country: typeof rawLocale.country === 'string' ? rawLocale.country.slice(0, 64) : 'Brasil',
      currencyCode: typeof rawLocale.currencyCode === 'string' ? rawLocale.currencyCode.slice(0, 12) : 'BRL',
      currencySymbol: typeof rawLocale.currencySymbol === 'string' ? rawLocale.currencySymbol.slice(0, 8) : 'R$',
    };

    const adminCatalog = isAdmin && Array.isArray(body.adminCatalog) ? body.adminCatalog.slice(0, 80) : [];

    // Remove markup and bound every user-controlled prompt field.
    const sanitize = (s) => typeof s === 'string' ? s.replace(/<[^>]*>/g, '').slice(0, 500) : '';
    const field = (s, max = 160) => sanitize(s).slice(0, max);
    const safeHistory = history.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: sanitize(m.content),
    }));

    let systemContent = SYSTEM_PROMPT;

    if (isAdmin) {
      // Admin recebe seção especial com tarifas de frete e permissão para dados completos
      systemContent += ADMIN_PROMPT_SECTION;
    }

    systemContent += `\n\nCONTEXTO: ${isAdmin ? 'o administrador está consultando para' : 'o cliente está comprando para'} **${locale.country}** (moeda ${locale.currencyCode}). O site já exibe todos os preços e fretes convertidos automaticamente pra essa moeda — você nunca precisa escrever, converter ou estimar nenhum valor, isso já está resolvido pelo sistema.`;

    if (isAdmin && adminCatalog.length) {
      const lines = adminCatalog
        .map((p) => {
          const promo = p.discount ? ` (-${field(p.discount, 24)}%)` : '';
          const cost = p.costYen ? ` | Custo: ¥${field(p.costYen, 24)}` : '';
          const wt = p.weightGrams
            ? ` | Peso: ${field(p.weightGrams.small, 16)}g (P) / ${field(p.weightGrams.large, 16)}g (G)`
            : '';
          const hidden = p.hidden ? ' [OCULTO]' : '';
          return `- [${field(p.id, 120)}] ${field(p.name)} [${field(p.category, 80)}] ¥${field(p.priceYen, 24)}${promo}${cost}${wt}${hidden}`;
        })
        .join('\n');
      systemContent += `\n\nCATÁLOGO ADMIN COMPLETO (${adminCatalog.length} itens, inclui ocultos):\n${lines}\n\nOs preços/custos acima são só para sua análise interna. NUNCA escreva o ID de um produto (o código entre colchetes) na resposta visível — ele não é um link, o admin não entende esse formato; IDs só podem aparecer depois de ||| na tag abaixo. Toda vez que citar, recomendar ou responder um pedido de link/foto/preço de um produto — inclusive follow-ups tipo "manda o link desse" sobre algo já mencionado antes — cite o ID pela tag |||PRODUCT_IDS ao final da resposta (mesmo formato do catálogo de cliente) em vez de repetir preço/ID em texto; o card exibido já mostra o valor real, a foto e o botão de ação. Se o produto mencionado antes não estiver na lista de IDs acima, diga que precisa buscar de novo — nunca invente um ID.`;
    } else if (catalog.length) {
      const lines = catalog
        .map((p) => {
          const promo = p.discount ? ` (-${field(p.discount, 24)}%)` : '';
          const wt = p.approxWeightGrams ? ` | ~${field(p.approxWeightGrams, 16)}g` : '';
          return `- [${field(p.id, 120)}] ${field(p.name)} [${field(p.category, 80)}] ¥${field(p.priceYen, 24)}${promo}${wt}`;
        })
        .join('\n');
      systemContent += `\n\nCATÁLOGO ATUAL DA LOJA (${catalog.length} itens — use SOMENTE isto para dizer o que existe). O código entre colchetes no início de cada linha é o ID único do produto:\n${lines}\n\nOs preços em ¥ acima são só para sua referência interna (ex.: julgar se algo é "mais em conta") — NUNCA copie, escreva ou converta esse número na sua resposta. NUNCA escreva o ID de um produto (o código entre colchetes) na resposta visível — ele NÃO é um link e o cliente não entende esse formato; IDs só podem aparecer depois de ||| na tag abaixo. REGRA DE LINK/RECOMENDAÇÃO: toda vez que citar, recomendar, comparar, ou responder um pedido de link/foto/preço de um ou mais produtos do catálogo — inclusive quando o cliente pede de novo ("manda o link", "qual o link desse", "manda a foto", "e o preço?") de algo já mencionado antes na conversa — adicione AO FINAL da sua resposta (em uma única linha, nunca no meio do texto) a tag |||PRODUCT_IDS: seguida dos IDs exatos (os que estão entre colchetes acima) separados por vírgula, sem espaços, máximo 5. Ex.: "Encontrei o Shampoo X e o Condicionador Y! |||PRODUCT_IDS: shampoo-x,cond-y". A parte depois de ||| é ocultada do cliente e vira automaticamente, para CADA produto, um card clicável separado com foto, nome, preço real e botão de adicionar ao carrinho — por isso a resposta em texto deve ser SÓ uma frase curta de introdução, sem repetir nome, preço ou descrição de cada item (os cards já separam item por item, isso não precisa estar no texto). Se algum produto mencionado antes na conversa não aparecer na lista de IDs acima, diga que precisa buscar de novo pelo nome — NUNCA invente ou reaproveite um ID de memória. Se você não recomendar nenhum produto específico do catálogo, NÃO inclua a tag.`;
    }

    if (systemContent.length > 100_000) {
      res.status(413).json({ error: 'prompt_too_large' });
      return;
    }

    const baseMessages = [{ role: 'system', content: systemContent }, ...safeHistory];

    const { text, model: usedModel, attempts } = await chatWithFallback({
      providers,
      messages: baseMessages,
      maxTokens: isAdmin ? 2048 : 600,
      temperature: 0.5,
    });

    if (!text) {
      // `attempts` diz qual provedor/modelo falhou e por quê (sem chaves) — é o
      // que permite descobrir na hora quando um modelo é aposentado.
      res.status(502).json({ error: 'upstream-or-empty', attempts });
      return;
    }

    if (containsUngroundedMoney(text, systemContent)) {
      // Valor monetário na resposta que não vem do catálogo/dados reais injetados —
      // trata como possível alucinação e descarta. O frontend cai no mesmo fallback
      // determinístico usado quando a IA está fora do ar.
      res.status(502).json({ error: 'ungrounded-money-detected' });
      return;
    }

    res.status(200).json({ text, model: usedModel });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
