import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProviders,
  chatWithFallback,
  clearModelCache,
  modelsFor,
  pickGeminiModels,
  pickGroqModels,
  retryDelayMs,
} from './ai-providers.js';

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const answer = (text) => json(200, { choices: [{ message: { content: text } }] });

describe('ai-providers', () => {
  beforeEach(() => clearModelCache());

  it('só cria provedores com chave, Groq primeiro e Gemini de reserva', () => {
    expect(buildProviders({}).map((p) => p.name)).toEqual([]);
    expect(buildProviders({ GROQ_API_KEY: 'g', ZAI_API_KEY: 'z', GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'o' }).map((p) => p.name))
      .toEqual(['groq', 'gemini', 'openrouter', 'glm']);
  });

  it('escolhe o Gemini flash estável mais novo, lite por último, sem preview', () => {
    const ids = [
      'models/gemini-2.5-flash-lite', 'models/gemini-2.5-pro', 'models/gemini-2.5-flash',
      'models/gemini-3.0-flash', 'models/gemini-3.0-flash-preview-09', 'models/text-embedding-004',
    ];
    expect(pickGeminiModels(ids)).toEqual(['gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  });

  it('Gemini tenta primeiro os modelos preferidos (os mais rápidos medidos)', async () => {
    const [gemini] = buildProviders({ GEMINI_API_KEY: 'k' });
    const list = vi.fn(async () => json(200, { data: [
      { id: 'models/gemini-3.8-flash' }, { id: 'models/gemini-3.5-flash' }, { id: 'models/gemini-2.5-flash' },
    ] }));
    expect(await modelsFor(gemini, { fetchImpl: list })).toEqual(['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.8-flash']);
  });

  it('no Groq ignora modelos de áudio/guarda e os desativados', () => {
    const ids = ['whisper-large-v3', 'llama-guard-4', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'];
    expect(pickGroqModels(ids)).toEqual(['openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile']);
    expect(pickGroqModels(['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'])).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
  });

  it('descobre modelos na API do provedor e cai nos padrões se a lista falhar', async () => {
    const [groq] = buildProviders({ GROQ_API_KEY: 'g' });
    const ok = vi.fn(async () => json(200, { data: [{ id: 'qwen/qwen3-32b' }] }));
    expect(await modelsFor(groq, { fetchImpl: ok })).toEqual(['qwen/qwen3-32b']);

    clearModelCache();
    const down = vi.fn(async () => json(500, {}));
    expect(await modelsFor(groq, { fetchImpl: down })).toEqual(groq.fallbackModels);
  });

  it('pula modelo aposentado e responde com o próximo, registrando as tentativas', async () => {
    const providers = buildProviders({ GROQ_API_KEY: 'g' });
    const fetchImpl = vi.fn(async (url, init) => {
      if (url.endsWith('/models')) return json(200, { data: [{ id: 'llama-3.3-70b-versatile' }, { id: 'qwen/qwen3-32b' }] });
      const { model } = JSON.parse(init.body);
      return model === 'qwen/qwen3-32b'
        ? json(404, { error: { message: 'The model does not exist' } })
        : answer('Olá! Posso ajudar.');
    });
    const out = await chatWithFallback({ providers, messages: [{ role: 'user', content: 'oi' }], fetchImpl });
    expect(out.text).toBe('Olá! Posso ajudar.');
    expect(out.model).toBe('groq/llama-3.3-70b-versatile');
    expect(out.attempts[0]).toMatchObject({ provider: 'groq', model: 'qwen/qwen3-32b', status: 404, error: 'The model does not exist' });
  });

  it('se o Gemini recusa o parâmetro de raciocínio, repete sem ele', async () => {
    const providers = buildProviders({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-x-flash' });
    const bodies = [];
    const fetchImpl = vi.fn(async (url, init) => {
      if (url.endsWith('/models')) return json(500, {});
      const body = JSON.parse(init.body);
      bodies.push(body);
      return 'reasoning_effort' in body ? json(400, { error: { message: 'unsupported reasoning_effort' } }) : answer('ok');
    });
    const out = await chatWithFallback({ providers, messages: [], fetchImpl });
    expect(out.text).toBe('ok');
    expect(bodies[0].reasoning_effort).toBe('minimal');
    expect('reasoning_effort' in bodies[1]).toBe(false);
  });

  it('chamada que não responde vira "tempo esgotado" em vez de travar', async () => {
    vi.useFakeTimers();
    try {
      const providers = buildProviders({ ZAI_API_KEY: 'z', ZAI_MODEL: 'glm-x' });
      const fetchImpl = vi.fn((url, init) => new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }));
      const pending = chatWithFallback({ providers, messages: [], fetchImpl, deadlineMs: 16_000 });
      await vi.advanceTimersByTimeAsync(16_000);
      const out = await pending;
      expect(out.text).toBeNull();
      expect(out.attempts[0]).toMatchObject({ provider: 'glm', model: 'glm-x', error: 'tempo esgotado' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('entende o tempo de espera do 429 nos formatos do Gemini', () => {
    expect(retryDelayMs('Please retry in 13.5s.')).toBe(13_500);
    expect(retryDelayMs('Please retry in 15h42.756752702s.')).toBe(15 * 3_600_000 + 42_757);
    expect(retryDelayMs('{"retryDelay": "40s"}')).toBe(40_000);
    expect(retryDelayMs('Please try again in 1m26.4s. Visit')).toBe(86_400);
    expect(retryDelayMs('Please try again in 450ms.')).toBe(450);
    expect(retryDelayMs('sem informação')).toBeNull();
  });

  it('modelo com cota diária esgotada fica de fora nas próximas perguntas', async () => {
    const providers = buildProviders({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-a' });
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      if (url.endsWith('/models')) return json(200, { data: [{ id: 'models/gemini-2.5-flash' }] });
      const { model } = JSON.parse(init.body);
      calls.push(model);
      return model === 'gemini-a'
        ? json(429, { error: { message: 'limit per day exceeded. Please retry in 15h2s.' } })
        : answer('ok');
    });
    await chatWithFallback({ providers, messages: [], fetchImpl });
    await chatWithFallback({ providers, messages: [], fetchImpl });
    expect(calls).toEqual(['gemini-a', 'gemini-2.5-flash', 'gemini-2.5-flash']);
  });

  it('depois de ferramentas, resposta vazia vale como fim (não troca de modelo)', async () => {
    const providers = buildProviders({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-a' });
    const fetchImpl = vi.fn(async (url) => (url.endsWith('/models') ? json(500, {}) : json(200, { choices: [{ message: { content: '' } }] })));
    const out = await chatWithFallback({ providers, messages: [], tools: [{}], allowEmpty: true, fetchImpl });
    expect(out).toMatchObject({ text: '', toolCalls: [], model: 'gemini/gemini-a' });
  });

  it('Gemini 3 recebe assinatura nas chamadas de ferramenta feitas por outro modelo; GLM/Groq não recebem o campo', async () => {
    const history = [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'a', type: 'function', function: { name: 'x', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'a', content: '{}' },
    ];
    const bodies = [];
    const fetchImpl = vi.fn(async (url, init) => {
      if (url.endsWith('/models')) return json(500, {});
      bodies.push(JSON.parse(init.body));
      return answer('ok');
    });
    await chatWithFallback({ providers: buildProviders({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.5-flash' }), messages: history, fetchImpl });
    expect(bodies[0].messages[1].tool_calls[0].extra_content.google.thought_signature).toBe('skip_thought_signature_validator');

    const signed = [history[0], { ...history[1], tool_calls: [{ ...history[1].tool_calls[0], extra_content: { google: { thought_signature: 's' } } }] }, history[2]];
    await chatWithFallback({ providers: buildProviders({ GROQ_API_KEY: 'g', GROQ_MODEL: 'llama' }), messages: signed, fetchImpl });
    expect('extra_content' in bodies[1].messages[1].tool_calls[0]).toBe(false);
  });
});
