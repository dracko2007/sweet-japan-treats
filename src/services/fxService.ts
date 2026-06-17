// Cotação cambial ao vivo: converte ¥ → R$/€ usando a taxa do dia (atualizada
// diariamente), com uma margem de segurança de +5 ienes por produto para
// proteger contra a flutuação. Se a API falhar, usa a última taxa em cache
// (ou um fallback fixo). Assim o preço em real/euro acompanha o iene sozinho.
import { safeStorage } from '@/utils/storage';

const BUFFER_YEN = 5; // margem de segurança somada ao ¥ antes de converter
// Fallback fixo (≈ o que era usado antes) caso a API e o cache falhem.
const FALLBACK = { BRL: 1 / 28, EUR: 0.16 / 28 };
const CACHE_KEY = 'fx_rates';

let _rates: { BRL: number; EUR: number } = { ...FALLBACK };

// Tenta carregar a última taxa salva já na inicialização do módulo.
try {
  const c = JSON.parse(safeStorage.getItem(CACHE_KEY) || 'null');
  if (c?.rates?.BRL && c?.rates?.EUR) _rates = c.rates;
} catch { /* ignore */ }

export const FX_BUFFER_YEN = BUFFER_YEN;

/** Taxas atuais (¥→BRL e ¥→EUR). */
export const getRates = () => _rates;

/** Converte ¥ para a moeda informada, com cotação do dia + margem de +5¥.
 *  JPY permanece em ienes (sem conversão nem margem). */
export function convertYen(yen: number, currency: string): number {
  if (currency === 'JPY') return Math.round(yen);
  if (!yen || yen <= 0) return 0;
  const rate = currency === 'EUR' ? _rates.EUR : _rates.BRL;
  return Math.round((yen + BUFFER_YEN) * rate);
}

/** Busca a cotação do dia (¥→BRL/EUR) e cacheia por dia. Retorna as taxas. */
export async function loadFxRates(): Promise<{ BRL: number; EUR: number }> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const cached = JSON.parse(safeStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.date === today && cached?.rates?.BRL && cached?.rates?.EUR) {
      _rates = cached.rates;
      return _rates;
    }
  } catch { /* ignore */ }

  try {
    // API gratuita, sem chave, atualizada diariamente.
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await res.json();
    const brl = Number(data?.rates?.BRL);
    const eur = Number(data?.rates?.EUR);
    if (brl > 0 && eur > 0) {
      _rates = { BRL: brl, EUR: eur };
      safeStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, rates: _rates }));
    }
  } catch { /* mantém cache/fallback */ }

  return _rates;
}
