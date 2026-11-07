// Cotação cambial ao vivo: converte ¥ → R$/€/$ via /api/wise-rate, que aplica a
// mesma cadeia usada para cobrar (Wise → open.er-api → fixo) e informa a origem.
//
// A conversão em si mora em `shared/money.js` — a MESMA função que o servidor
// usa para cobrar. Antes este arquivo tinha a sua própria cópia da fórmula;
// qualquer diferença entre as duas virava diferença entre a tela e a cobrança.
// Taxa PS (noBuffer=true) nunca tem margem — exibe o ¥ exato.
import { safeStorage } from '@/utils/storage';
import { FX_BUFFER_YEN as SHARED_FX_BUFFER_YEN, rateCushion, yenToDisplay } from '../../shared/money.js';

// Fallback: ¥→BRL ≈ 1/28, ¥→EUR ≈ 0.16/28, ¥→USD ≈ 1/150
const FALLBACK = { BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150 };
const CACHE_KEY = 'fx_rates';

type Rates = { BRL: number; EUR: number; USD: number };
type RateSource = 'wise' | 'open-er' | 'cache' | 'fallback';

let _rates: Rates = { ...FALLBACK };
let _source: RateSource = 'fallback';
// Id da cotação do servidor (`fx_rates/current`). Vai junto no pedido para o
// servidor cobrar com a mesma taxa que montou estes preços. Vazio quando a
// taxa não veio do servidor (cache antigo, open.er-api direto ou fixa).
let _ratesId = '';

try {
  const c = JSON.parse(safeStorage.getItem(CACHE_KEY) || 'null');
  if (c?.rates?.BRL && c?.rates?.EUR) {
    _rates = { ...FALLBACK, ...c.rates }; // USD pode faltar em cache antigo
    _source = 'cache';
    _ratesId = typeof c.id === 'string' ? c.id : '';
  }
} catch { /* ignore */ }

export const FX_BUFFER_YEN = SHARED_FX_BUFFER_YEN;

/** Taxas atuais (¥→BRL, ¥→EUR, ¥→USD). */
export const getRates = (): Rates => _rates;
export const getRateSource = () => _source;
export const getRatesId = () => _ratesId;

/** Cotação no formato de `shared/money.js` (a origem decide o cushion). */
export const getMoneyRates = () => ({ ..._rates, source: _source });

function rateFor(currency: string): number {
  if (currency === 'BRL') return _rates.BRL;
  if (currency === 'EUR') return _rates.EUR;
  return _rates.USD;
}

/** Converte BRL/EUR/USD de volta para ¥, desfazendo o mesmo cushion aplicado em convertYen. */
export function yenFromConverted(amount: number, currency: string): number {
  if (currency === 'JPY') return Math.round(amount);
  const baseRate = rateFor(currency);
  if (!baseRate) return 0;
  return Math.round(amount / (baseRate * (1 + rateCushion(getMoneyRates()))));
}

/** Converte ¥ para a moeda informada (BRL/EUR/USD), em unidade inteira.
 *  noBuffer=true omite todas as margens — use para taxas fixas (ex.: taxa PS). */
export function convertYen(yen: number, currency: string, noBuffer = false): number {
  return yenToDisplay(yen, currency, getMoneyRates(), { exact: noBuffer });
}

/** Busca cotação: `/api/wise-rate` (cadeia completa no servidor) → open.er-api.com. */
export async function loadFxRates(): Promise<Rates> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Endpoint próprio: a mesma cotação que o servidor usa para cobrar.
  //    Confiamos no `source` que ele informa: assumir 'wise' aqui zeraria o
  //    cushion de 4% e derrubaria todos os preços sempre que a taxa viesse,
  //    na verdade, do open.er-api.
  try {
    const res = await fetch('/api/wise-rate');
    if (res.ok) {
      const data = await res.json();
      const brl = Number(data?.JPY_BRL);
      const eur = Number(data?.JPY_EUR);
      const usd = Number(data?.JPY_USD);
      const source = data?.source === 'wise' ? 'wise' : 'open-er';
      // 'fallback' = servidor não alcançou nenhuma cotação viva; tenta direto.
      if (brl > 0 && eur > 0 && data?.source !== 'fallback') {
        _rates = { BRL: brl, EUR: eur, USD: usd > 0 ? usd : FALLBACK.USD };
        _source = source;
        _ratesId = typeof data?.id === 'string' ? data.id : '';
        safeStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, rates: _rates, source, id: _ratesId }));
        return _rates;
      }
    }
  } catch { /* cai no próximo */ }

  // 2. Cache local ainda válido para hoje
  try {
    const cached = JSON.parse(safeStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.date === today && cached?.rates?.BRL && cached?.rates?.EUR) {
      _rates = { ...FALLBACK, ...cached.rates };
      _source = cached.source === 'wise' ? 'wise' : 'cache';
      _ratesId = typeof cached.id === 'string' ? cached.id : '';
      return _rates;
    }
  } catch { /* ignore */ }

  // 3. open.er-api.com (gratuito, atualização diária). Não é a cotação do
  //    servidor: o pedido sai com a dele, e a revisão mostra esse valor.
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await res.json();
    const brl = Number(data?.rates?.BRL);
    const eur = Number(data?.rates?.EUR);
    const usd = Number(data?.rates?.USD);
    if (brl > 0 && eur > 0) {
      _rates = { BRL: brl, EUR: eur, USD: usd > 0 ? usd : FALLBACK.USD };
      _source = 'open-er';
      _ratesId = '';
      safeStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, rates: _rates, source: 'open-er', id: '' }));
    }
  } catch { _source = 'fallback'; }

  return _rates;
}
