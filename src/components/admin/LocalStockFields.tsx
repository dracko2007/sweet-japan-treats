import React, { useEffect, useState } from 'react';
import { MapPin, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { LocalStock } from '@/types';
import { WORLD_COUNTRIES } from '@/data/worldCountries';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { siteContentService, type LocalShippingTable } from '@/services/siteContentService';
import { BR_REGION_LABELS } from '../../../shared/local-stock.js';

const SYMBOL: Record<string, string> = { BRL: 'R$', EUR: '€', USD: 'US$', JPY: '¥' };
// O Japão é a origem normal da loja: "estoque local" só faz sentido fora dele.
const COUNTRIES = WORLD_COUNTRIES.map((c) => c.name).filter((name) => name !== 'Japão');

/**
 * Cadastro do produto: "este produto já está no país X" (empresa parceira).
 * Para cada país marcado, o preço fixo na moeda de lá — é exatamente o valor
 * cobrado do cliente daquele país, sem câmbio — e quantas unidades estão lá.
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
  // Zera em vez de apagar a chave: o produto é salvo com merge, e uma chave
  // simplesmente ausente continuaria valendo no banco.
  const remove = (country: string) => onChange({ ...stock, [country]: { enabled: false, price: 0, quantity: 0 } });

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
                {(!(entry.price > 0) || !(entry.quantity > 0)) && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                    Preencha preço e unidades: sem os dois o produto segue vendido só do Japão.
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
        O cliente daquele país vê só este preço, na moeda dele, e recebe com frete nacional (tabela abaixo da lista de produtos).
        A cada venda confirmada as unidades de lá diminuem; ao zerar, o produto volta a ser vendido do Japão, com o preço normal.
      </p>
    </div>
  );
};

const REGION_LABELS = BR_REGION_LABELS as Record<string, string>;
const REGIONS = Object.keys(REGION_LABELS);

/** Tabela do frete nacional: PAC por região no Brasil, valor único nos outros países. */
export const LocalShippingSettings: React.FC = () => {
  const { toast } = useToast();
  const [table, setTable] = useState<LocalShippingTable | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { siteContentService.getLocalShipping().then(setTable); }, []);
  if (!table) return null;

  const regions = table.Brasil?.regions || {};
  const others = Object.keys(table).filter((country) => country !== 'Brasil');
  const number = (text: string) => (text === '' ? undefined : Math.max(0, Math.round(Number(text) || 0)));

  const save = async () => {
    setSaving(true);
    try {
      await siteContentService.saveLocalShipping(table);
      toast({ title: '✅ Frete nacional salvo' });
    } catch (e) {
      toast({ title: 'Erro ao salvar o frete nacional', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="bg-card border border-border rounded-xl p-4">
      <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
        <MapPin className="w-4 h-4 text-emerald-600" /> Frete nacional (produtos que já estão no país do cliente)
      </summary>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold mb-2">Brasil — PAC por região (R$)</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {REGIONS.map((region) => (
              <label key={region} className="text-xs text-muted-foreground">
                {REGION_LABELS[region]}
                <input
                  type="number"
                  min={0}
                  aria-label={`PAC ${REGION_LABELS[region]}`}
                  value={regions[region] ?? ''}
                  onChange={(e) => setTable({ ...table, Brasil: { regions: { ...regions, [region]: number(e.target.value) } } })}
                  placeholder="R$"
                  className="mt-1 block w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Região sem valor não vende do Brasil: o pedido daquela região segue do Japão. Use 0 para frete grátis.</p>
        </div>
        {others.map((country) => (
          <label key={country} className="block text-xs text-muted-foreground">
            {country} — frete nacional único ({SYMBOL[getCurrencyByCountry(country)] || getCurrencyByCountry(country)})
            <input
              type="number"
              min={0}
              aria-label={`Frete nacional ${country}`}
              value={table[country]?.flat ?? ''}
              onChange={(e) => setTable({ ...table, [country]: { flat: number(e.target.value) } })}
              className="mt-1 block w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Adicionar país ao frete nacional"
            value=""
            onChange={(e) => { if (e.target.value) setTable({ ...table, [e.target.value]: { flat: undefined } }); }}
            className="px-3 py-2 rounded-lg border border-border bg-background text-xs"
          >
            <option value="">+ Frete nacional de outro país…</option>
            {COUNTRIES.filter((country) => country !== 'Brasil' && !others.includes(country)).map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          <Button size="sm" onClick={save} disabled={saving} className="btn-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar frete nacional
          </Button>
        </div>
      </div>
    </details>
  );
};
