import React from 'react';
import { MapPin } from 'lucide-react';
import type { LocalStock } from '@/types';
import { WORLD_COUNTRIES } from '@/data/worldCountries';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';

const SYMBOL: Record<string, string> = { BRL: 'R$', EUR: '€', USD: 'US$', JPY: '¥' };
// O Japão é a origem normal da loja: "estoque local" só faz sentido fora dele.
const COUNTRIES = WORLD_COUNTRIES.map((c) => c.name).filter((name) => name !== 'Japão');

/**
 * Cadastro do produto: "este produto já está no país X" (empresa parceira).
 * Para cada país marcado, o preço fixo na moeda de lá — é exatamente o valor
 * cobrado do cliente daquele país, sem câmbio —, quantas unidades estão lá e
 * o frete nacional daquele produto.
 */
export const LocalStockFields: React.FC<{
  value: LocalStock | undefined;
  onChange: (next: LocalStock | undefined) => void;
}> = ({ value, onChange }) => {
  const stock = value || {};
  // Brasil sempre aparece; os outros países só depois de adicionados.
  // (País removido fica gravado como desligado e zerado, e some da lista.)
  const rows = ['Brasil', ...Object.keys(stock).filter((country) => country !== 'Brasil'
    && (stock[country].enabled || stock[country].price > 0 || stock[country].quantity > 0))];
  const set = (country: string, patch: Partial<LocalStock[string]>) => {
    const current = stock[country] || { enabled: false, price: 0, quantity: 0 };
    onChange({ ...stock, [country]: { ...current, ...patch } });
  };
  // Zera (e grava frete null) em vez de apagar a chave: o produto é salvo com merge, e uma chave
  // simplesmente ausente continuaria valendo no banco.
  const remove = (country: string) => onChange({ ...stock, [country]: { enabled: false, price: 0, quantity: 0, shipping: null } });

  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-3">
      <label className="text-sm font-semibold flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-emerald-600" /> Produto que já está em outro país
      </label>
      {rows.map((country) => {
        const entry = stock[country] || { enabled: false, price: 0, quantity: 0 };
        const currency = getCurrencyByCountry(country);
        const id = `local-stock-${country}`;
        return (
          <div key={country} className="space-y-2 rounded-lg bg-white/70 dark:bg-black/20 p-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  id={id}
                  type="checkbox"
                  className="w-4 h-4"
                  checked={entry.enabled}
                  onChange={(e) => set(country, { enabled: e.target.checked })}
                />
                Produto enviado do {country}
              </label>
              {entry.enabled && (
                <span className="text-sm">
                  Valor cobrado: <strong className="text-emerald-700 dark:text-emerald-300">{entry.price > 0 ? formatPrice(entry.price, currency, true) : '—'}</strong>
                </span>
              )}
              {country !== 'Brasil' && (
                <button type="button" onClick={() => remove(country)} className="ml-auto text-xs text-destructive hover:underline">remover país</button>
              )}
            </div>
            {entry.enabled && (
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted-foreground">
                  Preço em {SYMBOL[currency] || currency} (valor final, sem conversão)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Preço no ${country}`}
                    value={entry.price || ''}
                    onChange={(e) => set(country, { price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    placeholder="Ex: 89"
                    className="mt-1 block w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Unidades no {country}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Unidades no ${country}`}
                    value={entry.quantity || ''}
                    onChange={(e) => set(country, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    placeholder="Ex: 10"
                    className="mt-1 block w-28 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Frete no {country} ({SYMBOL[currency] || currency}, 0 = grátis)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Frete no ${country}`}
                    value={entry.shipping ?? ''}
                    onChange={(e) => set(country, { shipping: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    placeholder="Ex: 25"
                    className="mt-1 block w-28 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  />
                </label>
                {(!(entry.price > 0) || !(entry.quantity > 0) || entry.shipping == null) && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                    Preencha preço, unidades e frete: sem os três o produto segue vendido só do Japão.
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <select
        aria-label="Adicionar outro país"
        value=""
        onChange={(e) => { if (e.target.value) set(e.target.value, { enabled: true }); }}
        className="px-3 py-2 rounded-lg border border-border bg-background text-xs"
      >
        <option value="">+ Outro país onde o produto já está…</option>
        {COUNTRIES.filter((country) => !rows.includes(country)).map((country) => <option key={country} value={country}>{country}</option>)}
      </select>
      <p className="text-[11px] text-muted-foreground">
        O cliente daquele país vê só este preço, na moeda dele, e paga o frete informado aqui. Com vários produtos no mesmo pedido vale o maior frete (um pacote só), não a soma.
        A cada venda confirmada as unidades de lá diminuem; ao zerar, o produto volta a ser vendido do Japão, com o preço normal.
      </p>
    </div>
  );
};
