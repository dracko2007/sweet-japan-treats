// Enriquecimento automático de produto (somente admin).
// 1. Busca produto na Rakuten Ichiba API (RAKUTEN_APP_ID env) → preço ¥ + fotos reais.
// 2. Usa Groq (Kimi K2 / Llama) para traduzir ou gerar a descrição no idioma-alvo.
// 3. Sem Rakuten: AI estima o preço com base no próprio conhecimento.
// Preço de venda = custo de aquisição × 1.5 (50% de markup).

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID || '';
const GROQ_API_KEY   = process.env.GROQ_API_KEY || '';
const GROQ_MODELS    = process.env.GROQ_MODEL
  ? [process.env.GROQ_MODEL]
  : ['moonshotai/kimi-k2-instruct', 'llama-3.3-70b-versatile'];

// ---- Rate limiting em memória (10 req/min por IP) --------------------------
const RATE_WINDOW_MS = 60_000;
const RATE_MAX       = 10;
const ipMap          = new Map();

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
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap) { if (now > entry.resetAt) ipMap.delete(ip); }
}, RATE_WINDOW_MS * 2);

// ---- CORS ------------------------------------------------------------------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const DEFAULT_ORIGINS = [
  'https://japanexpress-store.com',
  'https://www.japanexpress-store.com',
  'http://localhost:8080',
  'http://localhost:5173',
];
const VALID_ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;

// ---- Busca no Rakuten Ichiba -----------------------------------------------
let lastRakutenDebug = null; // diagnóstico temporário

async function searchRakuten(productName) {
  lastRakutenDebug = { hasAppId: !!RAKUTEN_APP_ID, appIdLen: (RAKUTEN_APP_ID || '').length };
  if (!RAKUTEN_APP_ID) { lastRakutenDebug.reason = 'RAKUTEN_APP_ID ausente'; return null; }
  try {
    const params = new URLSearchParams({
      format:        'json',
      keyword:       productName,
      applicationId: RAKUTEN_APP_ID,
      hits:          '5',
      imageFlag:     '1',
      availability:  '1',
      sort:          '-reviewCount',
    });
    const r = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params}`
    );
    lastRakutenDebug.status = r.status;
    if (!r.ok) {
      lastRakutenDebug.body = (await r.text().catch(() => '')).slice(0, 300);
      return null;
    }
    const data = await r.json();
    lastRakutenDebug.count = (data?.Items || []).length;
    // A API envolve cada item em { Item: {...} } ou retorna direto
    const rawItems = (data?.Items || []).map(i => i?.Item || i).filter(Boolean);
    if (!rawItems.length) return null;

    const item = rawItems[0];
    const priceYen    = Number(item.itemPrice) || 0;
    const descJa      = (item.itemCaption || item.itemDescription || '')
      .replace(/<[^>]*>/g, '').trim().slice(0, 1200);
    const suggestName = (item.itemName || productName).slice(0, 120);

    // mediumImageUrls pode ser array de strings ou de objetos {imageUrl}
    const rawImgs = item.mediumImageUrls || item.smallImageUrls || [];
    const images  = rawImgs
      .map(u => (typeof u === 'string' ? u : u?.imageUrl || ''))
      .filter(Boolean)
      .map(u => u.replace('?_ex=128x128', '')) // tenta versão maior
      .slice(0, 5);

    return { priceYen, descJa, images, suggestName, source: 'rakuten' };
  } catch (e) {
    lastRakutenDebug.error = String(e?.message || e);
    return null;
  }
}

// ---- Tradução / geração de descrição via Groq ------------------------------
async function buildDescription(productName, descJa, targetLang) {
  if (!GROQ_API_KEY) return '';
  const langMap = { pt: 'português do Brasil', en: 'English', ja: '日本語' };
  const langName = langMap[targetLang] || 'português do Brasil';

  const content = descJa
    ? `Você é especialista em produtos japoneses. Traduza e adapte a descrição abaixo para ${langName}, tornando-a atraente e convincente para uma loja online de importados do Japão. Mantenha os detalhes técnicos relevantes. Responda SOMENTE com a descrição (3-4 parágrafos fluidos), sem título, sem introdução, sem comentários.\n\nDescrição original (japonês/inglês):\n${descJa}`
    : `Você é especialista em produtos japoneses. Escreva uma descrição comercial em ${langName} para o produto "${productName}", vendido em uma loja de importados do Japão. Destaque: características, benefícios, qualidade japonesa, modo de uso se relevante. Responda SOMENTE com a descrição (3-4 parágrafos), sem título nem comentários.`;

  for (const model of GROQ_MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body:    JSON.stringify({ model, max_tokens: 700, temperature: 0.65,
          messages: [{ role: 'user', content }] }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch {}
  }
  return '';
}

// ---- Tradução em TODOS os idiomas (pt/en/ja) em uma chamada (JSON) ----------
async function buildI18n(productName, descJa) {
  if (!GROQ_API_KEY) return null;
  const prompt = `Produto importado do Japão. Nome (pode estar em japonês): "${productName}".
Descrição original (japonês/inglês, pode estar vazia): ${descJa || '(vazia — crie uma descrição comercial atraente)'}

Gere o NOME e uma DESCRIÇÃO comercial atraente (2-3 parágrafos) para uma loja online de importados do Japão, em 3 idiomas.
Responda APENAS com JSON válido, sem texto antes/depois, exatamente neste formato:
{"pt":{"name":"","description":""},"en":{"name":"","description":""},"ja":{"name":"","description":""}}
pt = português do Brasil, en = English, ja = 日本語. Não use markdown.`;

  for (const model of GROQ_MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model, max_tokens: 1600, temperature: 0.6,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      const parsed = JSON.parse(text);
      if (parsed?.pt?.description || parsed?.en?.description || parsed?.ja?.description) return parsed;
    } catch { /* tenta próximo modelo */ }
  }
  return null;
}

// ---- Estimativa de preço via IA (fallback sem Rakuten) ---------------------
async function estimatePriceAI(productName) {
  if (!GROQ_API_KEY) return 0;
  const prompt = `Qual o preço de varejo médio em ienes japoneses (¥) do produto "${productName}" vendido no Japão? Responda APENAS com o número inteiro, sem texto, sem símbolo. Exemplo: 1280`;
  for (const model of GROQ_MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body:    JSON.stringify({ model, max_tokens: 20, temperature: 0.1,
          messages: [{ role: 'user', content: prompt }] }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.choices?.[0]?.message?.content || '').replace(/[^0-9]/g, '');
      const p    = parseInt(text, 10);
      if (p > 0) return p;
    } catch {}
  }
  return 0;
}

// ---- Handler principal -----------------------------------------------------
export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  const isAllowedOrigin = VALID_ORIGINS.some(o => origin.startsWith(o));

  if (origin && !isAllowedOrigin) {
    res.status(403).json({ error: 'Origem não autorizada' });
    return;
  }
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // Barreira básica: apenas sessões admin chamam este endpoint
  if (body.isAdmin !== true) {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }

  const productName = typeof body.productName === 'string'
    ? body.productName.trim().slice(0, 200) : '';
  if (!productName) {
    res.status(400).json({ error: 'productName obrigatório' });
    return;
  }

  const targetLang = ['pt', 'en', 'ja'].includes(body.targetLang)
    ? body.targetLang : 'pt';
  const markup = typeof body.markup === 'number' ? body.markup : 1.5; // padrão 50%

  try {
    // 1. Busca no Rakuten (paralelo com geração de descrição quando possível)
    const rakuten = await searchRakuten(productName);

    // 2. Preço de custo
    let costYen = rakuten?.priceYen || 0;
    if (!costYen) costYen = await estimatePriceAI(productName);

    // 3. Traduções em todos os idiomas (pt/en/ja) + descrição do idioma atual
    const i18n = await buildI18n(productName, rakuten?.descJa || '');
    const description = i18n?.[targetLang]?.description
      || await buildDescription(productName, rakuten?.descJa || '', targetLang);

    // 4. Preço de venda = custo × markup
    const sellingPriceYen = costYen ? Math.round(costYen * markup) : 0;

    res.status(200).json({
      description,
      i18n,                       // { pt:{name,description}, en:{...}, ja:{...} }
      costYen,                    // custo de aquisição (Rakuten ou estimado)
      sellingPriceYen,            // preço de venda final (custo × markup)
      images:      rakuten?.images || [],
      suggestName: i18n?.[targetLang]?.name || rakuten?.suggestName || productName,
      source:      rakuten ? 'rakuten' : 'ai',
      ...(body.debug === true ? { rakutenDebug: lastRakutenDebug } : {}),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
