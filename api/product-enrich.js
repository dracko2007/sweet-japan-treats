// Enriquecimento automático de produto (somente admin).
// 1. Busca produto no Yahoo Shopping/Rakuten → preço ¥ + fotos reais.
// 2. Baixa a descrição real do Yahoo quando a API traz descrição vazia.
// 3. Usa Groq para manter nome em inglês e traduzir somente a descrição.
// 4. Sem marketplace: AI estima o preço com base no próprio conhecimento.
// Preço de venda = custo de aquisição × 1.5 (50% de markup).

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID || '';
const YAHOO_APP_ID   = process.env.YAHOO_APP_ID || ''; // Yahoo! Shopping Client ID
const GROQ_API_KEY   = process.env.GROQ_API_KEY || '';
const DEFAULT_GROQ_MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'];
const DISABLED_GROQ_MODELS = new Set(['moonshotai/kimi-k2-instruct']);
const GROQ_MODELS = uniqueNonEmpty([
  ...(process.env.GROQ_MODEL || '').split(','),
  ...DEFAULT_GROQ_MODELS,
]).filter((model) => !DISABLED_GROQ_MODELS.has(model));

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

const hasJapanese = (s) => /[぀-ヿ㐀-鿿]/.test(s || '');

function uniqueNonEmpty(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const s = String(value || '').trim();
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function cleanDescription(text, maxLen = 1200) {
  return decodeHtmlEntities(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/(?:\s*-?\s*)?通販\s*-\s*LINEアカウント連携でPayPayポイント.*$/i, '')
    .replace(/Yahoo!ショッピング.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function attrValue(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return m ? m[2] : '';
}

function extractYahooDescriptionFromHtml(html) {
  const candidates = [];
  const decodedHtml = decodeHtmlEntities(html);

  for (const m of decodedHtml.matchAll(/<script[^>]+type=["']text\/template["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const text = cleanDescription(m[1]);
    if (text.length > 80) candidates.push(text);
  }

  const info = decodedHtml.match(/商品情報[\s\S]{0,2500}/);
  if (info) {
    const text = cleanDescription(info[0]);
    if (text.length > 80) candidates.push(text);
  }

  const metaTags = decodedHtml.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const prop = attrValue(tag, 'property').toLowerCase();
    const name = attrValue(tag, 'name').toLowerCase();
    if (prop !== 'og:description' && name !== 'description') continue;
    const text = cleanDescription(attrValue(tag, 'content'));
    if (text.length > 30) candidates.push(text);
  }

  return candidates
    .filter((text) => !/^高品質なサプリメント、化粧品などを/.test(text))
    .sort((a, b) => b.length - a.length)[0] || '';
}

async function fetchYahooPageDescription(url) {
  let timer = null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('shopping.yahoo.co.jp')) return '';

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    if (!r.ok) return '';
    const html = await r.text();
    return extractYahooDescriptionFromHtml(html);
  } catch {
    return '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params}`,
      { headers: { Referer: 'https://japanexpress-store.com/', 'User-Agent': 'JapanExpress/1.0' } }
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
    const descJa      = cleanDescription(item.itemCaption || item.itemDescription || '');
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

// ---- Busca no Yahoo! Shopping (Japão) --------------------------------------
let yahooDebug = null;
async function searchYahoo(productName) {
  const appid = (YAHOO_APP_ID || '').trim();
  yahooDebug = { hasAppId: !!appid, appIdLen: appid.length };
  if (!appid) { yahooDebug.reason = 'YAHOO_APP_ID ausente'; return null; }
  try {
    const params = new URLSearchParams({ appid, query: productName, results: '5' });
    const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?${params}`;
    yahooDebug.qs = params.toString().replace(appid, 'APPID');
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    yahooDebug.status = r.status;
    if (!r.ok) { yahooDebug.body = (await r.text().catch(() => '')).slice(0, 400); return null; }
    const data = await r.json();
    const hits = data?.hits || [];
    yahooDebug.count = hits.length;
    yahooDebug.total = data?.totalResultsAvailable;
    yahooDebug.returned = data?.totalResultsReturned;
    yahooDebug.keys = Object.keys(data || {}).slice(0, 8);
    if (!hits.length) return null;

    const item = hits[0];
    const priceYen    = Number(item.price) || 0;
    let descJa        = cleanDescription(item.description || item.headLine || '');
    if (descJa.length < 80 && item.url) {
      const pageDesc = await fetchYahooPageDescription(item.url);
      yahooDebug.pageDescLen = pageDesc.length;
      yahooDebug.itemUrl = item.url;
      if (pageDesc.length > descJa.length) descJa = pageDesc;
    }
    const suggestName = (item.name || productName).slice(0, 120);
    // Prioriza a imagem ESTENDIDA (exImage = maior/HD). Só usa média se não houver HD.
    const hd  = hits.map(h => h.exImage?.url).filter(Boolean);
    const med = hits.map(h => h.image?.medium || h.image?.small).filter(Boolean);
    // Sobe a resolução das URLs do yimg para a maior versão (/i/z/ = HD)
    const upscale = (u) => u.replace(/\/i\/[a-z]\//, '/i/z/');
    const images = [...new Set((hd.length ? hd : med).map(upscale))].slice(0, 5);
    return { priceYen, descJa, images, suggestName, source: 'yahoo' };
  } catch (e) {
    yahooDebug.error = String(e?.message || e);
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

// ---- Nome em INGLÊS + descrição traduzida (a partir da descrição real do Yahoo) ----
// Regras do lojista: o NOME do produto fica em INGLÊS (não traduz). A DESCRIÇÃO
// vem da descrição original (Yahoo, em japonês) e é traduzida por IA (pt/en/ja).
let i18nDebug = null;
async function buildI18n(productName, descJa) {
  i18nDebug = { called: true };
  if (!GROQ_API_KEY) return null;
  const prompt = `Produto importado do Japão.
Nome de referência (pode estar em inglês/japonês): "${productName}".
Descrição ORIGINAL do produto (japonês, vinda da loja — pode estar vazia):
${descJa || '(vazia — crie uma descrição comercial curta e fiel ao produto)'}

Tarefas:
1) "name_en": o NOME do produto em INGLÊS, curto e comercial (marca + tipo). NÃO traduza para português.
2) Traduza/adapte a DESCRIÇÃO original acima (mantendo os fatos do produto) em 3 idiomas, 2-3 parágrafos, atraente para loja online.

Responda APENAS com JSON válido, sem markdown, exatamente neste formato:
{"name_en":"","pt":{"description":""},"en":{"description":""},"ja":{"description":""}}
pt = português do Brasil, en = English, ja = 日本語.`;

  for (const model of GROQ_MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model, max_tokens: 1600, temperature: 0.6,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!r.ok) { i18nDebug = { model, status: r.status, body: (await r.text().catch(()=> '')).slice(0,200) }; continue; }
      const data = await r.json();
      let text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      // Extrai o bloco JSON do texto (caso venha com markdown/explicação)
      const m = text.match(/\{[\s\S]*\}/);
      if (m) text = m[0];
      const parsed = JSON.parse(text);
      if (parsed?.pt?.description || parsed?.en?.description || parsed?.ja?.description) {
        // Mantém o nome em inglês para TODOS os idiomas (não traduz o nome)
        const nameEn = (parsed.name_en || '').trim();
        i18nDebug = {
          model,
          ok: true,
          nameLen: nameEn.length,
          ptLen: (parsed.pt?.description || '').length,
          enLen: (parsed.en?.description || '').length,
          jaLen: (parsed.ja?.description || '').length,
        };
        return {
          name_en: nameEn,
          pt: { description: parsed.pt?.description || '' },
          en: { description: parsed.en?.description || '' },
          ja: { description: parsed.ja?.description || '' },
        };
      }
    } catch { /* tenta próximo modelo */ }
  }
  return null;
}

// ---- Traduz nome (PT/EN) para termos de busca em JAPONÊS via Groq ----------
function localJapaneseTerms(name) {
  const n = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const terms = [];

  if (/hada\s*labo|gokujyun|gokujun|goku-jyun/.test(n)) {
    if (/lotion|toner|化粧水/.test(n)) {
      terms.push('肌ラボ 極潤 化粧水', 'ロート 肌ラボ 極潤 化粧水');
    }
    terms.push('肌ラボ 極潤', 'ハダラボ ゴクジュン');
  }

  if (/biore|biore|uv/.test(n) && /aqua\s*rich|アクアリッチ/.test(n)) {
    if (/watery\s*essence|water/i.test(n)) {
      terms.push('ビオレUV アクアリッチ ウォータリーエッセンス');
    }
    if (/light\s*up/i.test(n)) {
      terms.push('ビオレUV アクアリッチ ライトアップエッセンス');
    }
    terms.push('Biore UV アクアリッチ', 'ビオレUV アクアリッチ');
  }

  if (/dhc/.test(n) && /cleansing\s*oil/.test(n)) terms.push('DHC ディープクレンジングオイル');
  if (/shiseido|senka/.test(n)) terms.push('専科', '資生堂 専科');
  if (/kit\s*kat|kitkat/.test(n) && /matcha|green\s*tea/.test(n)) terms.push('キットカット 抹茶');
  if (/melano\s*cc/.test(n)) terms.push('メラノCC');
  if (/softymo|kose/.test(n) && /cleansing\s*oil/.test(n)) terms.push('ソフティモ クレンジングオイル');

  return uniqueNonEmpty(terms);
}

function parseJapaneseTermList(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const json = raw.match(/\[[\s\S]*\]/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return uniqueNonEmpty(parsed).filter(hasJapanese);
    } catch {}
  }

  return uniqueNonEmpty(
    raw.split(/\r?\n|,|、/)
      .map((s) => s.replace(/^[-*\d.)\s]+/, '').replace(/["「」『』\[\]]/g, '').trim())
  ).filter(hasJapanese);
}

async function toJapaneseKeywords(name) {
  if (!GROQ_API_KEY) return [];
  const prompt = `Você conhece os produtos vendidos no Yahoo Shopping Japão.
Crie 3 a 5 TERMOS DE BUSCA japoneses para encontrar o produto abaixo no Yahoo/Rakuten.

Regras:
- Se o nome estiver em inglês/romaji, converta para o nome japonês oficial e/ou katakana usado nas lojas japonesas.
- Preserve marca + linha + tipo do produto. Ex.: se tiver "lotion", inclua 化粧水; se tiver "watery essence", inclua ウォータリーエッセンス.
- Use o nome real da marca/produto, não uma transliteração fonética inventada.
- Inclua variações úteis misturando inglês da marca + japonês quando isso for comum no Yahoo.

Exemplos:
"Hada Labo Gokujyun Lotion" → ["肌ラボ 極潤 化粧水","ロート 肌ラボ 極潤 化粧水","ハダラボ ゴクジュン 化粧水"]
"Biore UV Aqua Rich Watery Essence" → ["Biore UV アクアリッチ","ビオレUV アクアリッチ ウォータリーエッセンス","花王 ビオレUV アクアリッチ"]
"DHC Deep Cleansing Oil" → ["DHC ディープクレンジングオイル","DHC クレンジングオイル"]

Responda APENAS com um JSON array de strings.
Produto: "${name}"`;
  for (const model of GROQ_MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model, max_tokens: 180, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const terms = parseJapaneseTermList(data?.choices?.[0]?.message?.content || '');
      if (terms.length) return terms.slice(0, 5);
    } catch {}
  }
  return [];
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

function chooseEnglishName(...candidates) {
  for (const candidate of candidates) {
    const name = String(candidate || '').trim();
    if (!name) continue;
    if (hasJapanese(name)) continue;
    if (!/[A-Za-z0-9]/.test(name)) continue;
    return name.slice(0, 120);
  }
  return '';
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
    // 0. Monta termos de busca: original em inglês/romaji + japonês/katakana.
    const localTerms = hasJapanese(productName) ? [] : localJapaneseTerms(productName);
    const aiTerms = hasJapanese(productName) ? [] : await toJapaneseKeywords(productName);
    const terms = uniqueNonEmpty([productName, ...localTerms, ...aiTerms]).slice(0, 8);

    // 1. Busca a fonte real: tenta cada termo no Yahoo → Rakuten até achar.
    let rakuten = null;
    let searchTerm = productName;
    for (const term of terms) {
      rakuten = (await searchYahoo(term)) || (await searchRakuten(term));
      if (rakuten) { searchTerm = term; break; }
    }

    // 2. Preço de custo
    let costYen = rakuten?.priceYen || 0;
    if (!costYen) costYen = await estimatePriceAI(productName);

    // 3. Nome em INGLÊS + descrição traduzida (a partir da descrição real do Yahoo)
    const enrich = await buildI18n(productName, rakuten?.descJa || '');
    const i18n = enrich
      ? { pt: enrich.pt, en: enrich.en, ja: enrich.ja } // só descrições (nome fica em inglês)
      : null;
    const description = i18n?.[targetLang]?.description
      || await buildDescription(productName, rakuten?.descJa || '', targetLang);
    // Nome do produto em inglês (não traduz). Usa o do IA, senão o nome real do Yahoo, senão o digitado.
    const nameEn = chooseEnglishName(enrich?.name_en, productName, rakuten?.suggestName) || productName;

    // 4. Preço de venda = custo × markup
    const sellingPriceYen = costYen ? Math.round(costYen * markup) : 0;

    res.status(200).json({
      description,
      i18n,                       // { pt:{description}, en:{description}, ja:{description} }
      costYen,                    // custo de aquisição (Rakuten ou estimado)
      sellingPriceYen,            // preço de venda final (custo × markup)
      images:      rakuten?.images || [],
      suggestName: nameEn,        // nome em inglês (não traduzido)
      source:      rakuten?.source || 'ai',
      ...(body.debug === true ? { rakutenDebug: lastRakutenDebug, yahooDebug, searchTerm, searchTerms: terms, i18nDebug } : {}),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
