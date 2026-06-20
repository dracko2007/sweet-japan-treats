// Função serverless (Vercel) — "cérebro" do KimiClaw via Groq (tier grátis, rápido).
// A chave fica SÓ no servidor (process.env.GROQ_API_KEY) e nunca vai pro navegador.
// Sem a chave, retorna 503 e o KimiClaw responde pelas regras (fallback).
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

const DEFAULT_GROQ_MODELS = [
  'llama-3.3-70b-versatile',        // principal — 70B, rápido
  'llama-3.3-70b-specdec',          // variante especulativa do 70B (alta disponibilidade)
  'deepseek-r1-distill-llama-70b',  // fallback 70B com raciocínio
  'llama-3.1-8b-instant',           // último recurso leve
];
const DISABLED_GROQ_MODELS = new Set(['moonshotai/kimi-k2-instruct', 'openai/gpt-oss-120b']);
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
const GROQ_MODELS = uniqueNonEmpty([
  ...(process.env.GROQ_MODEL || '').split(','),
  ...DEFAULT_GROQ_MODELS,
]).filter((model) => !DISABLED_GROQ_MODELS.has(model));

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
const SYSTEM_PROMPT = `Você é o KimiClaw, o assistente virtual simpático da loja "Japan Express" (japanexpress-store.com),
que importa produtos do Japão (cosméticos, doces e chás, snacks, papelaria, eletrônicos, vestuário, higiene & saúde).
Contato para falar com um vendedor/administrador: WhatsApp +81 70-1367-1679 (wa.me/817013671679) e e-mail contato@japanexpress-store.com.
Sempre que disser "confirme com um vendedor/administrador", ofereça esse WhatsApp/e-mail.
Responda SEMPRE em português do Brasil, de forma amigável e útil. Para clientes: respostas curtas (no máximo 4 frases). Use emojis com moderação.

REGRA IMPORTANTE: sempre que fizer QUALQUER cálculo, conta, estimativa de preço, frete, imposto, conversão de moeda
ou prazo, deixe claro na resposta que "isso é uma estimativa para fácil elucidação" e que os valores reais devem ser
confirmados com um vendedor ou administrador. Nunca apresente um número calculado como valor final/garantido.

Fatos da loja:
- Envio do Japão (Hiroshima) por Correios/EMS; impostos de importação são cobrados pela Receita Federal e pagos online antes da liberação (nunca ao carteiro).
- Pagamento: PIX e Wise (Brasil), PayPay (Japão).
- Pontos: 1 por avaliação, 5 pts por minuto de vídeo de review (após validação), 1 ponto a cada ¥100 em produtos, 1000 no aniversário; 1 ponto = ¥1 de desconto.
- Páginas: Produtos, Frete, Como Funciona, Faça seu Pedido, Empresas.

PRODUTOS / ESTOQUE: o catálogo atual da loja é enviado abaixo (quando disponível). Responda sobre disponibilidade
SOMENTE com base nessa lista — é o estoque real publicado. Se o item pedido ESTÁ na lista, confirme citando o nome e o
preço (em ¥) e lembre que o site converte para R$/€. Se NÃO estiver na lista, diga claramente que não temos no momento e
que dá para encomendar pelo "Faça seu Pedido" (no menu do topo). NUNCA invente produtos, marcas ou disponibilidade que
não estejam na lista. Se a lista não vier, peça para a pessoa digitar o nome que o catálogo é pesquisado.`;

// Seção extra inserida APENAS para sessões admin
const ADMIN_PROMPT_SECTION = `

=== MODO ADMINISTRADOR ===
Você está conversando com um ADMINISTRADOR da loja. Pode fornecer informações completas e técnicas:
- Mostrar custos de aquisição (¥), margens e dados financeiros
- Calcular fretes com precisão usando os pesos reais dos produtos
- Mostrar produtos ocultos (marcados como [OCULTO] no catálogo abaixo)
- NÃO use a ressalva "confirme com um vendedor" — o admin é o vendedor

CÁLCULO DE FRETE — TARIFAS ATUAIS (origem Japão/Hiroshima):

BRASIL:
  PAC (Correios econômico):  base R$ 120 + R$ 35 por kg | prazo ~5-7 dias úteis
  EMS (Correios prioritário): base R$ 220 + R$ 60 por kg | prazo ~2-4 dias úteis
  Expresso (courier):         base R$ 350 + R$ 85 por kg | prazo ~1-3 dias úteis

JAPÃO (entrega doméstica):
  Japan Post ゆうパック:  base ¥ 700 + ¥ 150 por kg | prazo 1-2 dias
  Yamato ヤマト宅急便:   base ¥ 800 + ¥ 180 por kg | prazo 1-3 dias

EUROPA (Portugal, França, Itália, Espanha):
  Correio local EMS:  base € 20 + € 6 por kg  | prazo ~5-7 dias
  DHL/FedEx Express:  base € 35 + € 10 por kg | prazo ~2-4 dias

COMO CALCULAR:
  1. Identifique o produto no catálogo admin (campo "Peso" indica gramas por variante)
  2. Converta para kg: peso_g ÷ 1000
  3. Frete = base + (taxa_por_kg × peso_kg)
  4. Para múltiplos itens, some os pesos antes de calcular
  5. Apresente as opções de transportadora com valor e prazo

MARGEM E CUSTO:
  Margem bruta (%) = ((preço_venda_¥ - custo_¥) / preço_venda_¥) × 100
  Conversão para R$: preço_¥ ÷ 28 (taxa usada pela loja)
  Conversão para €:  (preço_¥ ÷ 28) × 0,16
  O campo "Custo" no catálogo abaixo é o preço de aquisição no Japão (¥).

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

  // ---------- Chave Groq ----------
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'AI not configured' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Limita histórico e catálogo para controlar uso de tokens
    const history = Array.isArray(body.messages) ? body.messages.slice(-6) : [];
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

    systemContent += `\n\nMOEDA E PAÍS DE ENVIO: ${isAdmin ? 'o administrador está consultando para' : 'o cliente está comprando para'} **${locale.country}**.
Use SEMPRE o símbolo **${locale.currencySymbol}** (${locale.currencyCode}) nos valores — NÃO use ¥ a menos que o país seja o Japão.
Conversão usada pela loja a partir do preço em ienes (¥): Brasil → R$ = ¥ ÷ 28; Europa (Portugal/França/Itália/Espanha) → € = (¥ ÷ 28) × 0,16; Japão → mantém ¥.`;

    if (!isAdmin) {
      systemContent += `

ESTIMATIVA DE PREÇO: se o cliente perguntar "quanto custa", "qual o preço", "quanto fica/sai" de um produto que NÃO está no
catálogo, você é OBRIGADO a dar a estimativa — NÃO responda apenas "não temos". Calcule INTERNAMENTE (sem mostrar as contas):
a) preço de varejo típico em ienes no Japão (seu conhecimento; você NÃO acessa a internet); b) acrescente 40%;
c) converta para ${locale.currencySymbol} (Brasil: ¥÷28); d) some uma estimativa de frete internacional.

REGRA DE APRESENTAÇÃO (MUITO IMPORTANTE): mostre APENAS o valor final aproximado em ${locale.currencySymbol} (pode dar uma
faixa, ex.: "em torno de ${locale.currencySymbol} X" ou "${locale.currencySymbol} X a Y", já com o frete incluído).
NUNCA revele nem mencione: o preço em ienes, a margem/acréscimo, os "40%", "personal shopper", nem o passo a passo do cálculo.
Não detalhe "produto + frete"; entregue só o total estimado.
Sempre acompanhe do aviso: é apenas uma estimativa para fácil elucidação, aproximada e ACIMA do valor real, NÃO é o preço
correto, e para o valor real é preciso falar com um vendedor/administrador. Depois diga que o item não está no catálogo e
pode ser pedido pelo "Faça seu Pedido". Nunca apresente o número como preço final/garantido.`;
    }

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
      systemContent += `\n\nCATÁLOGO ADMIN COMPLETO (${adminCatalog.length} itens, inclui ocultos):\n${lines}`;
    } else if (catalog.length) {
      const lines = catalog
        .map((p) => {
          const promo = p.discount ? ` (-${p.discount}%)` : '';
          return `- ${p.name} [${p.category}] ¥${p.priceYen}${promo}`;
        })
        .join('\n');
      systemContent += `\n\nCATÁLOGO ATUAL DA LOJA (${catalog.length} itens — use SOMENTE isto para dizer o que existe):\n${lines}`;
    }

    const baseMessages = [{ role: 'system', content: systemContent }, ...safeHistory];

    let text = null;
    let usedModel = null;
    let lastStatus = 0;
    let lastDetail = '';

    for (const model of GROQ_MODELS) {
      let r;
      for (let attempt = 0; attempt < 2; attempt++) {
        r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
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
        if (t) { text = t; usedModel = model; break; }
      }
    }

    if (!text) {
      res.status(502).json({ error: 'upstream-or-empty', status: lastStatus, detail: lastDetail.slice(0, 300) });
      return;
    }
    res.status(200).json({ text, model: usedModel });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
