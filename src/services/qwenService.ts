// Cliente do "cérebro" do assistente virtual. Chama a função serverless /api/kimiclaw,
// que guarda as chaves de IA (Gemini/Google AI Studio, com GLM e Groq de reserva)
// no servidor — nunca no navegador. Se a IA não responder, retorna null e o
// assistente usa as regras locais.
import { auth } from '@/config/firebase';

export interface QwenMsg { role: 'user' | 'assistant'; content: string; }
export interface CatalogItem { name: string; category: string; priceYen: number; discount?: number; approxWeightGrams?: number; }

// Catálogo estendido enviado APENAS em sessões admin (inclui dados sensíveis de negócio).
export interface AdminCatalogItem extends CatalogItem {
  id: string;
  costYen?: number;                          // custo de aquisição
  weightGrams?: { small: number; large: number }; // peso estimado por variante
  hidden?: boolean;                          // produto oculto ao público
}

export interface Locale { country: string; currencyCode: string; currencySymbol: string; }

// KimiClaw: skills determinísticos (busca, carrinho, orçamento, frete, cupom, admin)
// continuam 100% por regras — a IA nunca calcula preço/frete/número de negócio,
// só entra pra conversa/recomendação quando nenhum skill determinístico bate.
// Ver api/kimiclaw.js (SYSTEM_PROMPT + containsUngroundedMoney) para as garantias
// contra alucinação de preço.
export const qwenEnabled = (): boolean => true;

const AI_TIMEOUT_MS = 32_000;

export interface AskQwenOptions {
  isAdmin?: boolean;
  adminCatalog?: AdminCatalogItem[];
}

/** Pergunta ao Qwen via /api/kimiclaw, enviando o catálogo e a moeda/país do cliente. */
export async function askQwen(
  history: QwenMsg[],
  catalog?: CatalogItem[],
  locale?: Locale,
  options?: AskQwenOptions,
): Promise<string | null> {
  try {
    const body: Record<string, unknown> = {
      messages: history.slice(-12),
      catalog: (catalog || []).slice(0, 120),
      locale,
    };
    if (options?.isAdmin) {
      body.adminCatalog = (options.adminCatalog || []).slice(0, 200);
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Manda o token sempre que há sessão — o SERVIDOR decide se é admin.
    // O adminCatalog (com custos) só vai se o frontend acredita ser admin,
    // pois esses dados são sensíveis e não devem trafegar para clientes comuns.
    if (auth) {
      try {
        await auth.authStateReady();
        if (auth.currentUser) {
          headers['x-firebase-token'] = await auth.currentUser.getIdToken();
        }
      } catch {
        // sem token → endpoint trata como não-admin
      }
    }

    // Limite de espera: sem isto, uma IA lenta deixava o chat preso em
    // "digitando…" com o campo bloqueado. Um pouco acima dos 30s do servidor.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const res = await fetch('/api/kimiclaw', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null; // 503 sem chave, 502 upstream, etc.
    const data = await res.json();
    return (data?.text as string) || null;
  } catch {
    return null;
  }
}

// ---------- Modo agente (ferramentas) ----------

export interface AgentToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
  extra_content?: unknown;
}

export type AgentMsg =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: AgentToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface AgentLocale { country: string; currencyCode: string; language: 'pt' | 'en' | 'ja' }

export interface AgentReply { text: string; toolCalls: AgentToolCall[] }

/** Uma rodada do agente: devolve a resposta final OU as ferramentas que a IA quer usar. null = falhou. */
export async function askAgent(messages: AgentMsg[], locale: AgentLocale): Promise<AgentReply | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const res = await fetch('/api/kimiclaw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'agent', messages, locale }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = await res.json();
    const toolCalls = Array.isArray(data?.toolCalls) ? (data.toolCalls as AgentToolCall[]) : [];
    const text = typeof data?.text === 'string' ? data.text : '';
    return text || toolCalls.length ? { text, toolCalls } : null;
  } catch {
    return null;
  }
}
