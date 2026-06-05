// Função serverless (Vercel) — "cérebro" do KimiClaw via Groq (tier grátis, rápido).
// A chave fica SÓ no servidor (process.env.GROQ_API_KEY) e nunca vai pro navegador.
// Sem a chave, retorna 503 e o KimiClaw responde pelas regras (fallback).
// Modelos do Groq em ordem de preferência (mais inteligente primeiro), com fallback.
// Kimi K2 é um modelo gigante (MoE ~1T) e muito capaz; cai para gpt-oss-120b e llama-70b.
// Evitamos modelos de "raciocínio" (gpt-oss) que consomem os tokens pensando e
// devolvem conteúdo vazio. Kimi K2 (forte) com fallback para llama-70b.
const GROQ_MODELS = process.env.GROQ_MODEL
  ? [process.env.GROQ_MODEL]
  : ['moonshotai/kimi-k2-instruct', 'llama-3.3-70b-versatile'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = `Você é o KimiClaw, o assistente virtual simpático da loja "Japan Express" (japanexpress-store.com),
que importa produtos do Japão (cosméticos, doces e chás, snacks, papelaria, eletrônicos, vestuário, higiene & saúde).
Contato para falar com um vendedor/administrador: WhatsApp +81 70-1367-1679 (wa.me/817013671679) e e-mail contato@japanexpress-store.com.
Sempre que disser "confirme com um vendedor/administrador", ofereça esse WhatsApp/e-mail.
Responda SEMPRE em português do Brasil, de forma curta, amigável e útil (no máximo 4 frases). Use emojis com moderação.

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
    const catalog = Array.isArray(body.catalog) ? body.catalog.slice(0, 120) : [];
    const locale = body.locale || { country: 'Brasil', currencyCode: 'BRL', currencySymbol: 'R$' };

    let systemContent = SYSTEM_PROMPT;

    // Moeda do destino + regras de estimativa de preço
    systemContent += `\n\nMOEDA E PAÍS DE ENVIO: o cliente está comprando para **${locale.country}**.
Use SEMPRE o símbolo **${locale.currencySymbol}** (${locale.currencyCode}) nos valores — NÃO use ¥ a menos que o país seja o Japão.
Conversão usada pela loja a partir do preço em ienes (¥): Brasil → R$ = ¥ ÷ 28; Europa (Portugal/França/Itália/Espanha) → € = (¥ ÷ 28) × 0,16; Japão → mantém ¥.

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
    if (catalog.length) {
      const lines = catalog
        .map((p) => {
          const promo = p.discount ? ` (-${p.discount}%)` : '';
          return `- ${p.name} [${p.category}] ¥${p.priceYen}${promo}`;
        })
        .join('\n');
      systemContent += `\n\nCATÁLOGO ATUAL DA LOJA (${catalog.length} itens — use SOMENTE isto para dizer o que existe):\n${lines}`;
    }

    const baseMessages = [{ role: 'system', content: systemContent }, ...history];

    let text = null;
    let lastStatus = 0;
    let lastDetail = '';
    // Tenta cada modelo em ordem; pula para o próximo em erro OU resposta vazia.
    for (const model of GROQ_MODELS) {
      let r;
      for (let attempt = 0; attempt < 2; attempt++) {
        r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, max_tokens: 600, temperature: 0.5, messages: baseMessages }),
        });
        if (r.ok) break;
        lastStatus = r.status;
        lastDetail = await r.text().catch(() => '');
        if (r.status === 429 && attempt === 0) { await sleep(1000); continue; }
        break; // 404/400/etc → próximo modelo
      }
      if (r && r.ok) {
        const data = await r.json().catch(() => null);
        const t = data?.choices?.[0]?.message?.content?.trim();
        if (t) { text = t; break; } // só aceita resposta não-vazia
      }
    }

    if (!text) {
      res.status(502).json({ error: 'upstream-or-empty', status: lastStatus, detail: lastDetail.slice(0, 300) });
      return;
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
