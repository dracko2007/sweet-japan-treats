// Função serverless (Vercel) — "cérebro" do KimiClaw via Groq (tier grátis, rápido).
// A chave fica SÓ no servidor (process.env.GROQ_API_KEY) e nunca vai pro navegador.
// Sem a chave, retorna 503 e o KimiClaw responde pelas regras (fallback).
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = `Você é o KimiClaw, o assistente virtual simpático da loja "Japan Express" (japan-express.vercel.app),
que importa produtos do Japão (cosméticos, doces e chás, snacks, papelaria, eletrônicos, vestuário, higiene & saúde).
Responda SEMPRE em português do Brasil, de forma curta, amigável e útil (no máximo 4 frases). Use emojis com moderação.

REGRA IMPORTANTE: sempre que fizer QUALQUER cálculo, conta, estimativa de preço, frete, imposto, conversão de moeda
ou prazo, deixe claro na resposta que "isso é uma estimativa para fácil elucidação" e que os valores reais devem ser
confirmados com um vendedor ou administrador. Nunca apresente um número calculado como valor final/garantido.

Fatos da loja:
- Envio do Japão (Hiroshima) por Correios/EMS; impostos de importação são cobrados pela Receita Federal e pagos online antes da liberação (nunca ao carteiro).
- Pagamento: PIX e Wise (Brasil), PayPay (Japão).
- Pontos: 1 por avaliação, 5 pts por minuto de vídeo de review (após validação), 1 ponto a cada ¥100 em produtos, 1000 no aniversário; 1 ponto = ¥1 de desconto.
- Páginas: Produtos, Frete, Como Funciona, Faça seu Pedido, Empresas.
Se quiserem buscar um produto, peça que digitem o nome que você busca no catálogo.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'AI not configured' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const history = Array.isArray(body.messages) ? body.messages.slice(-6) : [];

    const payload = {
      model: GROQ_MODEL,
      max_tokens: 400,
      temperature: 0.6,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    };

    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });
      if (r.status !== 429) break;
      if (attempt === 0) await sleep(1200);
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      res.status(502).json({ error: 'upstream', status: r.status, detail: detail.slice(0, 300) });
      return;
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || null;
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
