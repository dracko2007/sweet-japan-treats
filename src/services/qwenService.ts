// Integração opcional com o Qwen (via OpenRouter) para dar "cérebro" ao KimiClaw.
// Só funciona se VITE_OPENROUTER_API_KEY estiver definida (no Vercel/local).
// Sem a chave, o KimiClaw continua respondendo pelas regras (fallback).
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
// Modelo gratuito do Qwen no OpenRouter (pode trocar por env se quiser).
const QWEN_MODEL = (import.meta.env.VITE_QWEN_MODEL as string) || 'qwen/qwen-2.5-7b-instruct:free';

export const qwenEnabled = (): boolean => !!OPENROUTER_KEY;

const SYSTEM_PROMPT = `Você é o KimiClaw, o assistente virtual simpático da loja "Japan Express" (japan-express.vercel.app),
uma loja que importa produtos do Japão (cosméticos, doces e chás, snacks, papelaria, eletrônicos, vestuário, higiene).
Responda SEMPRE em português do Brasil, de forma curta, amigável e útil (no máximo 4 frases). Use emojis com moderação.
Fatos da loja para usar quando perguntarem:
- Envio do Japão (Hiroshima) por Correios/EMS; impostos de importação são cobrados pela Receita Federal e pagos online antes da liberação (não ao carteiro).
- Pagamento: PIX e Wise (Brasil), PayPay (Japão).
- Programa de pontos: 1 ponto por avaliação, 5 pts por minuto de vídeo de review (após validação), 1 ponto a cada ¥100 em produtos, 1000 pontos no aniversário; 1 ponto = ¥1 de desconto.
- Há páginas: Produtos, Frete, Como Funciona, Faça seu Pedido, Empresas.
Se o cliente quiser buscar um produto específico, sugira que ele digite o nome do produto que você busca no catálogo.
Nunca invente preços exatos nem prazos garantidos; oriente a conferir na página de Frete/Produtos.`;

export interface QwenMsg { role: 'user' | 'assistant'; content: string; }

/** Pergunta ao Qwen. Retorna o texto da resposta ou null (sem chave / erro). */
export async function askQwen(history: QwenMsg[]): Promise<string | null> {
  if (!OPENROUTER_KEY) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://japan-express.vercel.app',
        'X-Title': 'Japan Express KimiClaw',
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        max_tokens: 400,
        temperature: 0.6,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history.slice(-6)],
      }),
    });
    if (!res.ok) {
      console.warn('[qwen] resposta não-ok:', res.status);
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.warn('[qwen] falhou:', e);
    return null;
  }
}
