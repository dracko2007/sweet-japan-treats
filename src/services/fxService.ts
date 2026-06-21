// Cotação cambial ao vivo: converte ¥ → R$/€ usando a taxa real da Wise (via
// serverless /api/wise-rate). Se falhar, cai no open.er-api.com + RATE_CUSHION.
// Taxa PS (noBuffer=true) nunca tem margem — exibe o ¥ exato.
import { safeStorage } from '@/utils/storage';

const BUFFER_YEN = 5;    // margem fixa somada ao ¥ (proteção em itens pequenos)
const RATE_CUSHION = 0.015; // 1,5% de fallback — taxa de transferência da Wise
                             // (só aplica quando /api/wise-rate não está disponível)
const FALLBACK = { BRL: 1 / 28, EUR: 0.16 / 28 };
const CACHE_KEY = 'fx_rates';

let _rates: { BRL: number; EUR: number } = { ...FALLBACK };
let _source: 'wise' | 'open-er' | 'cache' | 'fallback' = 'fallback';

try {
  const c = JSON.parse(safeStorage.getItem(CACHE_KEY) || 'null');
  if (c?.rates?.BRL && c?.rates?.EUR) { _rates = c.rates; _source = 'cache'; }
} catch { /* ignore */ }

export const FX_BUFFER_YEN = BUFFER_YEN;

/** Taxas atuais (¥→BRL e ¥→EUR). */
export const getRates = () => _rates;
export const getRateSource = () => _source;

/** Converte ¥ para a moeda informada.
 *  - Quando a taxa vem da Wise: RATE_CUSHION reduzido (1,5%) — apenas fee de transferência
 *  - Quando a taxa vem de outra fonte: RATE_CUSHION completo para compensar defasagem
 *  noBuffer=true omite todas as margens — use para taxas fixas (ex.: taxa PS). */
export function convertYen(yen: number, currency: string, noBuffer = false): number {
  if (currency === 'JPY') return Math.round(yen);
  if (!yen || yen <= 0) return 0;
  const baseRate = currency === 'EUR' ? _rates.EUR : _rates.BRL;
  const cushion = _source === 'wise' ? RATE_CUSHION : 0.04;
  const rate = noBuffer ? baseRate : baseRate * (1 + cushion);
  return Math.round((yen + (noBuffer ? 0 : BUFFER_YEN)) * rate);
}

/** Busca cotação: tenta /api/wise-rate (taxa real Wise) → fallback open.er-api.com. */
export async function loadFxRates(): Promise<{ BRL: number; EUR: number }> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Tenta a Wise via serverless (atualiza a cada 10 min no servidor)
  try {
    const res = await fetch('/api/wise-rate');
    if (res.ok) {
      const data = await res.json();
      const brl = Number(data?.JPY_BRL);
      const eur = Number(data?.JPY_EUR);
      if (brl > 0 && eur > 0) {
        _rates = { BRL: brl, EUR: eur };
        _source = 'wise';
        safeStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, rates: _rates, source: 'wise' }));
        return _rates;
      }
    }
  } catch { /* cai no próximo */ }

  // 2. Cache local ainda válido para hoje
  try {
    const cached = JSON.parse(safeStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.date === today && cached?.rates?.BRL && cached?.rates?.EUR) {
      _rates = cached.rates;
      _source = cached.source === 'wise' ? 'wise' : 'cache';
      return _rates;
    }
  } catch { /* ignore */ }

  // 3. open.er-api.com (gratuito, atualização diária)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await res.json();
    const brl = Number(data?.rates?.BRL);
    const eur = Number(data?.rates?.EUR);
    if (brl > 0 && eur > 0) {
      _rates = { BRL: brl, EUR: eur };
      _source = 'open-er';
      safeStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, rates: _rates, source: 'open-er' }));
    }
  } catch { _source = 'fallback'; }

  return _rates;
}
