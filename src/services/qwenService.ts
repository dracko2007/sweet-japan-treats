// Cliente do "cérebro" do KimiClaw. Chama a função serverless /api/kimiclaw,
// que guarda a chave do OpenRouter no servidor (não fica exposta no navegador).
// Se a IA não estiver configurada/disponível, retorna null → KimiClaw usa as regras.

export interface QwenMsg { role: 'user' | 'assistant'; content: string; }
export interface CatalogItem { name: string; category: string; priceYen: number; discount?: number; }
export interface Locale { country: string; currencyCode: string; currencySymbol: string; }

// Tentamos sempre; se o endpoint não existir (dev local) ou a chave não estiver
// configurada, a chamada falha de leve e caímos no fallback por regras.
export const qwenEnabled = (): boolean => true;

/** Pergunta ao Qwen via /api/kimiclaw, enviando o catálogo e a moeda/país do cliente. */
export async function askQwen(history: QwenMsg[], catalog?: CatalogItem[], locale?: Locale): Promise<string | null> {
  try {
    const res = await fetch('/api/kimiclaw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-6), catalog: (catalog || []).slice(0, 120), locale }),
    });
    if (!res.ok) return null; // 503 sem chave, 502 upstream, etc.
    const data = await res.json();
    return (data?.text as string) || null;
  } catch {
    return null;
  }
}
