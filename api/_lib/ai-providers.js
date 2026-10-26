// Provedores de IA do assistente da loja (endpoints compatíveis com OpenAI).
//
// Ordem: Groq (principal, plano grátis maior) → Google AI Studio (Gemini) → OpenRouter → Z.ai (GLM). Cada um só entra se a
// chave existir no ambiente. A lista de modelos é DESCOBERTA na API do provedor
// (com cache), em vez de fixa no código: antes os nomes fixos foram aposentados
// pelo Groq e o assistente parou inteiro sem ninguém perceber.
//
// Toda chamada tem limite de tempo, e cada tentativa fica registrada em
// `attempts` (provedor/modelo/status/erro curto, nunca a chave) para diagnóstico.

const CALL_TIMEOUT_MS = 15_000;
const LIST_TIMEOUT_MS = 5_000;
const MODEL_CACHE_MS = 10 * 60_000;
const MAX_MODELS_PER_PROVIDER = 3;

// Modelos que não devem ser usados mesmo se aparecerem na descoberta.
// (O gpt-oss-120b ficava aqui porque o raciocínio dele comia o limite de saída e a
// resposta vinha vazia; com reasoning_effort 'low' — ver Groq abaixo — isso não ocorre.)
const DISABLED_MODELS = new Set(['moonshotai/kimi-k2-instruct']);

const splitEnv = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
const unique = (list) => [...new Set(list)];
const stripModelsPrefix = (id) => String(id || '').replace(/^models\//, '');

// ---------- Escolha de modelos a partir da lista do provedor ----------

/** Gemini: só os "flash" estáveis (rápidos e baratos), versão mais nova primeiro, "lite" por último. */
export function pickGeminiModels(ids) {
  const parsed = ids
    .map(stripModelsPrefix)
    .map((id) => {
      const m = id.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/);
      return m ? { id, version: Number(m[1]), lite: Boolean(m[2]) } : null;
    })
    .filter(Boolean);
  parsed.sort((a, b) => (a.lite - b.lite) || (b.version - a.version));
  // Aliases como "gemini-flash-latest" ficam de fora: em teste real (out/2026)
  // ora travavam 40s+, ora davam 503 por sobrecarga.
  return unique(parsed.map((p) => p.id));
}

// gpt-oss primeiro: no teste real (out/2026) o qwen errou nomes de campos das ferramentas.
const GROQ_PREFERENCE = [/gpt-oss-120b/, /gpt-oss-20b/, /qwen/, /llama-3\.3-70b/, /llama-4/, /llama/];
const GROQ_EXCLUDE = /whisper|guard|tts|playai|compound|distil|vision|embed/i;

/** Groq: modelos de chat, na ordem de preferência acima. */
export function pickGroqModels(ids) {
  const usable = ids.filter((id) => !GROQ_EXCLUDE.test(id) && !DISABLED_MODELS.has(id));
  const out = [];
  for (const pattern of GROQ_PREFERENCE) {
    for (const id of usable) if (pattern.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

// ---------- Ajuste das mensagens por provedor ----------

// O Gemini 3 exige a "assinatura de pensamento" em toda chamada de ferramenta do
// histórico. Chamadas feitas por outro modelo (ex.: o 2.5, antes de cair para o
// 3.x) não têm; a documentação do Gemini indica este valor para esses casos.
const SKIP_SIGNATURE = 'skip_thought_signature_validator';

function geminiMessages(messages, model) {
  if (/^gemini-2\./.test(model)) return messages;
  return messages.map((m) => (m.role === 'assistant' && Array.isArray(m.tool_calls)
    ? {
        ...m,
        tool_calls: m.tool_calls.map((tc) => (tc.extra_content?.google?.thought_signature
          ? tc
          : { ...tc, extra_content: { google: { thought_signature: SKIP_SIGNATURE } } })),
      }
    : m));
}

/** Outros provedores não conhecem `extra_content` (campo do Gemini). */
function plainMessages(messages) {
  return messages.map((m) => (m.role === 'assistant' && Array.isArray(m.tool_calls)
    ? { ...m, tool_calls: m.tool_calls.map(({ extra_content: _ignored, ...tc }) => tc) }
    : m));
}

/** "Please retry in 13.5s" / "15h42m3.2s" / "retryDelay": "40s" → ms, quando o provedor informa. */
export function retryDelayMs(raw) {
  const text = String(raw || '');
  // Gemini: "retry in 15h42.7s"; Groq: "try again in 1m26.4s" / "450ms".
  const m = text.match(/(?:retry|try again) (?:in|after) ((?:[\d.]+(?:ms|[hms])\s*)+)/i) || text.match(/"retryDelay"\s*:\s*"([\d.]+s)"/);
  if (!m) return null;
  let ms = 0;
  for (const [, n, unit] of m[1].matchAll(/([\d.]+)(ms|[hms])/gi)) {
    ms += Number(n) * ({ h: 3_600_000, m: 60_000, s: 1_000, ms: 1 })[unit.toLowerCase()];
  }
  return ms > 0 ? Math.ceil(ms) : null;
}

// ---------- Configuração dos provedores ----------

export function buildProviders(env = process.env) {
  const providers = [];
  if (env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      modelsUrl: 'https://api.groq.com/openai/v1/models',
      key: env.GROQ_API_KEY,
      envModels: splitEnv(env.GROQ_MODEL),
      fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      pick: pickGroqModels,
      // Raciocínio curto: gpt-oss aceita low/medium/high; qwen3 aceita none/default.
      extraBody: (model) => (/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : /qwen3/.test(model) ? { reasoning_effort: 'none' } : {}),
      maxTokensFloor: 0,
    });
  }
  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    providers.push({
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
      key: geminiKey,
      envModels: splitEnv(env.GEMINI_MODEL),
      // Medidos com a chave da loja (out/2026): 2.5-flash ~1s, 3.5-flash ~2s.
      // O mais novo (3.8-flash) dava 503. Os preferidos vêm antes da descoberta.
      preferredModels: ['gemini-2.5-flash', 'gemini-3.5-flash'],
      fallbackModels: ['gemini-2.5-flash', 'gemini-3.5-flash'],
      pick: pickGeminiModels,
      // O "pensamento" do Gemini consome o limite de saída e atrasa a resposta;
      // num chat de loja ele não é necessário. 2.5 aceita 'none'; 3.x, 'minimal'.
      extraBody: (model) => ({ reasoning_effort: /2\.5/.test(model) ? 'none' : 'minimal' }),
      maxTokensFloor: 2048,
      prepareMessages: geminiMessages,
    });
  }
  if (env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      modelsUrl: null,
      key: env.OPENROUTER_API_KEY,
      envModels: splitEnv(env.OPENROUTER_MODEL),
      // Inkling aceita ferramentas (necessário para o agente). A versão ":free" só
      // é liberada dentro de apps de agente da lista do OpenRouter — recusa sites
      // (403, testado em out/2026) —, então aqui vai a paga (~US$ 1/M entrada, 4,05/M saída).
      fallbackModels: ['thinkingmachines/inkling'],
      pick: null,
      // Sem raciocínio extra: mesma escolha de ferramenta no teste, mais rápido e mais barato.
      extraBody: () => ({ reasoning: { effort: 'none' } }),
      maxTokensFloor: 0,
      headers: { 'HTTP-Referer': 'https://japanexpress-store.com', 'X-Title': 'Japan Express' },
    });
  }
  if (env.ZAI_API_KEY) {
    providers.push({
      name: 'glm',
      url: 'https://api.z.ai/api/coding/paas/v4/chat/completions', // conta usa GLM Coding Plan
      modelsUrl: null,
      key: env.ZAI_API_KEY,
      envModels: splitEnv(env.ZAI_MODEL),
      fallbackModels: ['glm-5.2', 'glm-4.6', 'glm-4.5'],
      pick: null,
      extraBody: () => ({ thinking: { type: 'disabled' } }),
      maxTokensFloor: 0,
    });
  }
  return providers;
}

// ---------- Descoberta de modelos (com cache por instância) ----------

const modelCache = new Map(); // provider name → { at, models }

async function fetchWithTimeout(fetchImpl, url, init, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function modelsFor(provider, { fetchImpl = fetch, now = Date.now() } = {}) {
  let discovered = [];
  if (provider.modelsUrl && provider.pick) {
    const cached = modelCache.get(provider.name);
    if (cached && now - cached.at < MODEL_CACHE_MS) {
      discovered = cached.models;
    } else {
      try {
        const r = await fetchWithTimeout(
          fetchImpl,
          provider.modelsUrl,
          { headers: { Authorization: `Bearer ${provider.key}` } },
          LIST_TIMEOUT_MS,
        );
        if (r.ok) {
          const data = await r.json();
          const ids = (Array.isArray(data?.data) ? data.data : []).map((m) => m?.id).filter(Boolean);
          discovered = provider.pick(ids);
          if (discovered.length) modelCache.set(provider.name, { at: now, models: discovered });
        }
      } catch {
        // sem lista → usa os padrões abaixo
      }
    }
  }
  const preferred = (provider.preferredModels || []).filter((m) => !discovered.length || discovered.includes(m));
  const list = unique([...provider.envModels, ...preferred, ...(discovered.length ? discovered : provider.fallbackModels)])
    .filter((m) => !DISABLED_MODELS.has(m));
  return list.slice(0, MAX_MODELS_PER_PROVIDER + provider.envModels.length);
}

// Modelo com cota esgotada (429 com espera longa, ex.: limite diário do plano
// gratuito) fica de fora até liberar, em vez de custar uma tentativa por pergunta.
const cooldown = new Map(); // `${provider}/${model}` → liberado em (ms)
const COOLDOWN_MIN_MS = 60_000;

export function clearModelCache() {
  modelCache.clear();
  cooldown.clear();
}

// ---------- Chamada com fallback entre provedores/modelos ----------

const shortError = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    const msg = parsed?.error?.message || parsed?.message || parsed?.[0]?.error?.message;
    if (msg) return String(msg).slice(0, 160);
  } catch {
    // não era JSON
  }
  return String(raw || '').replace(/\s+/g, ' ').slice(0, 160);
};

const toolCallsOf = (data) => {
  const calls = data?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls
    .filter((c) => c?.function?.name)
    .map((c, i) => ({
      id: c.id || `call_${Date.now()}_${i}`,
      type: 'function',
      function: { name: c.function.name, arguments: typeof c.function.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function.arguments || {}) },
      ...(c.extra_content ? { extra_content: c.extra_content } : {}),
    }));
};

const contentOf = (data) => {
  const c = data?.choices?.[0]?.message?.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('').trim();
  return '';
};

/**
 * Tenta cada provedor/modelo até um responder. Retorna { text, toolCalls, model, attempts }.
 * Com `tools`, a IA pode pedir ferramentas: aí `toolCalls` vem preenchido.
 * `deadlineMs` é o orçamento total (a função serverless tem limite de duração).
 */
export async function chatWithFallback({
  providers,
  messages,
  tools,
  // Depois de resultados de ferramenta, resposta vazia é válida: a IA já
  // disse tudo junto com as chamadas e não tem mais nada a acrescentar.
  allowEmpty = false,
  maxTokens = 600,
  temperature = 0.5,
  deadlineMs = 25_000,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const startedAt = Date.now();
  const remaining = () => deadlineMs - (Date.now() - startedAt);
  const attempts = [];

  for (const provider of providers) {
    const models = await modelsFor(provider, { fetchImpl });
    for (const model of models) {
      if (remaining() < 2_000) return { text: null, toolCalls: [], model: null, attempts };
      const key = `${provider.name}/${model}`;
      if ((cooldown.get(key) || 0) > Date.now()) continue;
      let extra = provider.extraBody(model);
      const providerMessages = (provider.prepareMessages || plainMessages)(messages, model);
      for (let attempt = 0; attempt < 2; attempt++) {
        const record = { provider: provider.name, model, status: 0, error: '' };
        attempts.push(record);
        try {
          const r = await fetchWithTimeout(
            fetchImpl,
            provider.url,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}`, ...provider.headers },
              body: JSON.stringify({
                model,
                messages: providerMessages,
                temperature,
                max_tokens: Math.max(maxTokens, provider.maxTokensFloor),
                ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
                ...extra,
              }),
            },
            Math.min(CALL_TIMEOUT_MS, remaining()),
          );
          record.status = r.status;
          if (r.ok) {
            const data = await r.json().catch(() => null);
            const text = contentOf(data);
            const toolCalls = tools?.length ? toolCallsOf(data) : [];
            if (text || toolCalls.length || allowEmpty) return { text, toolCalls, model: `${provider.name}/${model}`, attempts };
            record.error = 'resposta vazia';
            break;
          }
          const raw = await r.text().catch(() => '');
          record.error = shortError(raw);
          // Parâmetro extra recusado (ex.: reasoning_effort) → tenta de novo sem ele.
          if (r.status === 400 && Object.keys(extra).length && attempt === 0 && !/thought_signature/i.test(raw)) { extra = {}; continue; }
          if (r.status === 429 && attempt === 0) {
            // Limite por minuto: espera o tempo pedido se couber no orçamento; senão, próximo modelo.
            const wait = retryDelayMs(raw) ?? 1_000;
            if (wait <= 8_000 && wait < remaining() - 5_000) { await sleep(wait); continue; }
            if (wait >= COOLDOWN_MIN_MS) cooldown.set(key, Date.now() + Math.min(wait, 6 * 3_600_000));
          }
          // Sem crédito (OpenRouter): pausa o provedor por 10 min em vez de tentar a cada pergunta.
          if (r.status === 402) for (const m of models) cooldown.set(`${provider.name}/${m}`, Date.now() + 10 * 60_000);
          break;
        } catch (e) {
          const aborted = e?.name === 'AbortError';
          record.error = aborted ? 'tempo esgotado' : String(e?.message || e).slice(0, 160);
          // Falha de rede momentânea ("fetch failed"): tenta o mesmo modelo mais uma vez.
          if (!aborted && attempt === 0 && remaining() > 5_000) continue;
          break;
        }
      }
    }
  }
  return { text: null, toolCalls: [], model: null, attempts };
}
