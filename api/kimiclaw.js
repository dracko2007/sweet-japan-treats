// Função serverless (Vercel) — "cérebro" do KimiClaw via GLM-5.2 (Z.ai).
// Prioriza ZAI_API_KEY (GLM-5.2); se ausente, cai no Groq (GROQ_API_KEY) — retrocompat.
// A chave fica SÓ no servidor e nunca vai pro navegador.
// Sem nenhuma chave configurada, retorna 503 e o KimiClaw responde pelas regras (fallback).
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function firebaseAdminAuth() {
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!sa) throw new Error('Firebase Admin not configured');
    initializeApp({ credential: cert(JSON.parse(sa)) });
  }
  return getAuth();
}

// ---------- Provedores de IA ----------
// GLM-5.2 via Z.ai é o provedor PRINCIPAL (mesma família do agente core da loja).
// Groq permanece como fallback opcional — mantém o assistente no ar se faltar a chave da Z.ai.
const ZAI_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions'; // conta usa GLM Coding Plan, não o PaaS padrão
const DEFAULT_ZAI_MODELS = [
  'glm-5.2',   // principal — GLM-5.2 (janela de contexto de 1M), raciocínio avançado
  'glm-4.6',   // fallback estável
  'glm-4.5',   // fallback adicional
];
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODELS = [
  'llama-3.3-70b-versatile',        // principal — 70B, rápido
  'llama-3.3-70b-specdec',          // variante especulativa do 70B (alta disponibilidade)
  'deepseek-r1-distill-llama-70b',  // fallback 70B com raciocínio
  'llama-3.1-8b-instant',           // último recurso leve
];
const DISABLED_MODELS = new Set(['moonshotai/kimi-k2-instruct', 'openai/gpt-oss-120b']);
const uniqueNonEmpty = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const s = String(value || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};
const ZAI_MODELS = uniqueNonEmpty([
  ...(process.env.ZAI_MODEL || '').split(','),
  ...DEFAULT_ZAI_MODELS,
]).filter((model) => !DISABLED_MODELS.has(model));
const GROQ_MODELS = uniqueNonEmpty([
  ...(process.env.GROQ_MODEL || '').split(','),
  ...DEFAULT_GROQ_MODELS,
]).filter((model) => !DISABLED_MODELS.has(model));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Rate limiting simples em memória (por IP, reseta ao cold start) ----------
// Suficiente para barrar bots no tier gratuito; em produção de alta escala usar Upstash/Redis.
const RATE_WINDOW_MS = 60_000; // 1 minuto
const RATE_MAX = 15;           // máximo de requisições por IP por janela
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
const SYSTEM_PROMPT = `Você é o KimiClaw, o assistente de compras da loja "Japan Express" (japanexpress-store.com),
que importa produtos do Japão (cosméticos, doces e chás, snacks, papelaria, eletrônicos, vestuário, higiene & saúde).
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

export default async function handler(req, res) {
  // ---------- Verificação de origem ----------
  const origin = req.headers['origin'] || '';
  const isAllowedOrigin = VALID_ORIGINS.some((o) => origin.startsWith(o));

  if (origin && !isAllowedOrigin) {
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

  // ---------- Rate limiting por IP ----------
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
    return;
  }

  // ---------- Chaves de IA (prioriza GLM-5.2 via Z.ai; Groq como fallback) ----------
  const zaiKey = process.env.ZAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!zaiKey && !groqKey) {
    res.status(503).json({ error: 'AI not configured' });
    return;
  }
  // Ordem de prioridade: GLM-5.2 primeiro (mais inteligente), Groq como reserva.
  const providers = [];
  if (zaiKey) providers.push({ name: 'glm', url: ZAI_API_URL, key: zaiKey, models: ZAI_MODELS });
  if (groqKey) providers.push({ name: 'groq', url: GROQ_API_URL, key: groqKey, models: GROQ_MODELS });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Limita histórico e catálogo para controlar uso de tokens. 12 turnos (~2k
    // tokens com o corte de 500 chars por mensagem) mantêm o produto recomendado
    // dentro da janela por várias perguntas de acompanhamento.
    const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 60) : [];
    const locale = body.locale || { country: 'Brasil', currencyCode: 'BRL', currencySymbol: 'R$' };

    // isAdmin é determinado pelo servidor via Firebase token — body.isAdmin é ignorado.
    // O cliente envia o token no header x-firebase-token; o servidor verifica e confere
    // se o email pertence ao admin. Sem token válido = não-admin, sem exceção.
    let isAdmin = false;
    const idToken = req.headers['x-firebase-token'];
    if (idToken) {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'dracko2007@gmail.com';
        const decoded = await firebaseAdminAuth().verifyIdToken(idToken);
        isAdmin = decoded.email?.toLowerCase() === adminEmail.toLowerCase();
      } catch {
        // token inválido ou expirado → não-admin
      }
    }

    const adminCatalog = isAdmin && Array.isArray(body.adminCatalog) ? body.adminCatalog.slice(0, 80) : [];

    // Sanitiza textos de entrada (remove tags HTML para evitar prompt injection)
    const sanitize = (s) => typeof s === 'string' ? s.replace(/<[^>]*>/g, '').slice(0, 500) : '';
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
      // Admin: catálogo completo com custo, peso e status oculto
      const lines = adminCatalog
        .map((p) => {
          const promo = p.discount ? ` (-${p.discount}%)` : '';
          const cost = p.costYen ? ` | Custo: ¥${p.costYen}` : '';
          const wt = p.weightGrams
            ? ` | Peso: ${p.weightGrams.small}g (P) / ${p.weightGrams.large}g (G)`
            : '';
          const hidden = p.hidden ? ' [OCULTO]' : '';
          return `- [${p.id}] ${p.name} [${p.category}] ¥${p.priceYen}${promo}${cost}${wt}${hidden}`;
        })
        .join('\n');
      systemContent += `\n\nCATÁLOGO ADMIN COMPLETO (${adminCatalog.length} itens, inclui ocultos):\n${lines}\n\nOs preços/custos acima são só para sua análise interna — ao recomendar um produto específico ao admin, cite o ID pela tag |||PRODUCT_IDS ao final da resposta (mesmo formato usado no catálogo de cliente) em vez de repetir o preço em texto; o card exibido já mostra o valor real.`;
    } else if (catalog.length) {
      const lines = catalog
        .map((p) => {
          const promo = p.discount ? ` (-${p.discount}%)` : '';
          const wt = p.approxWeightGrams ? ` | ~${p.approxWeightGrams}g` : '';
          return `- [${p.id}] ${p.name} [${p.category}] ¥${p.priceYen}${promo}${wt}`;
        })
        .join('\n');
      systemContent += `\n\nCATÁLOGO ATUAL DA LOJA (${catalog.length} itens — use SOMENTE isto para dizer o que existe). O código entre colchetes no início de cada linha é o ID único do produto:\n${lines}\n\nOs preços em ¥ acima são só para sua referência interna (ex.: julgar se algo é "mais em conta") — NUNCA copie, escreva ou converta esse número na sua resposta. RECOMENDAR PRODUTOS: sempre que citar/recomendar um ou mais produtos do catálogo, adicione AO FINAL da sua resposta (em uma única linha) a tag |||PRODUCT_IDS: seguida dos IDs exatos (os que estão entre colchetes) separados por vírgula, sem espaços, máximo 5. Ex.: "Encontrei o Shampoo X e o Condicionador Y! |||PRODUCT_IDS: shampoo-x,cond-y". A parte depois de ||| será ocultada do cliente e usada para mostrar os cards dos produtos (com o preço real). Se você não recomendar nenhum produto específico do catálogo, NÃO inclua a tag.`;
    }

    const baseMessages = [{ role: 'system', content: systemContent }, ...safeHistory];

    let text = null;
    let usedModel = null;
    let lastStatus = 0;
    let lastDetail = '';

    for (const provider of providers) {
      for (const model of provider.models) {
        let r;
        for (let attempt = 0; attempt < 2; attempt++) {
          r = await fetch(provider.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
            body: JSON.stringify({ model, max_tokens: isAdmin ? 2048 : 600, temperature: 0.5, messages: baseMessages }),
          });
          if (r.ok) break;
          lastStatus = r.status;
          lastDetail = await r.text().catch(() => '');
          if (r.status === 429 && attempt === 0) { await sleep(300); continue; }
          break;
        }
        if (r && r.ok) {
          const data = await r.json().catch(() => null);
          const t = data?.choices?.[0]?.message?.content?.trim();
          if (t) { text = t; usedModel = `${provider.name}/${model}`; break; }
        }
      }
      if (text) break;
    }

    if (!text) {
      res.status(502).json({ error: 'upstream-or-empty', status: lastStatus, detail: lastDetail.slice(0, 300) });
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
