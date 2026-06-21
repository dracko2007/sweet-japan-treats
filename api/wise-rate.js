// Proxy serverless para taxa de câmbio da Wise em tempo real.
// WISE_API_TOKEN fica apenas neste servidor — nunca exposto ao browser.
// Retorna: { JPY_BRL: number, JPY_EUR: number, source: 'wise'|'fallback', ts: number }

const WISE_API = 'https://api.wise.com/v1/rates';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

let _cache = null;

export default async function handler(req, res) {
  // CORS — permite apenas o próprio domínio
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, max-age=600'); // CDN cacheia 10 min

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Serve do cache em memória se ainda válido
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return res.json(_cache);
  }

  const token = process.env.WISE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'WISE_API_TOKEN not configured' });
  }

  try {
    const [resBRL, resEUR] = await Promise.all([
      fetch(`${WISE_API}?source=JPY&target=BRL`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${WISE_API}?source=JPY&target=EUR`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (!resBRL.ok || !resEUR.ok) {
      throw new Error(`Wise API error: BRL=${resBRL.status} EUR=${resEUR.status}`);
    }

    const [dataBRL, dataEUR] = await Promise.all([resBRL.json(), resEUR.json()]);

    // A Wise retorna array de objetos; pega o primeiro com source=JPY
    const brlRate = (Array.isArray(dataBRL) ? dataBRL : [dataBRL]).find(r => r.source === 'JPY' && r.target === 'BRL')?.rate;
    const eurRate = (Array.isArray(dataEUR) ? dataEUR : [dataEUR]).find(r => r.source === 'JPY' && r.target === 'EUR')?.rate;

    if (!brlRate || !eurRate) {
      throw new Error('Rate not found in Wise response');
    }

    _cache = { JPY_BRL: brlRate, JPY_EUR: eurRate, source: 'wise', ts: Date.now() };
    return res.json(_cache);
  } catch (err) {
    console.error('[wise-rate] Error:', err.message);
    // Retorna erro para o cliente usar o fallback
    return res.status(502).json({ error: err.message });
  }
}
