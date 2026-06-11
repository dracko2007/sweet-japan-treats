import React, { useState, useMemo, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRates } from '@/services/fxService';
import { formatPrice } from '@/utils/currency';
import { getELightRate, getKozutsumiRate, type JapanPostZone } from '@/utils/japanPostRates';

interface ProductRow {
  id: number;
  costYen: string;
  discountPct: string;
}

const AdminCalculator: React.FC = () => {
  const nextId = useRef(2);
  const [rows, setRows] = useState<ProductRow[]>([{ id: 1, costYen: '', discountPct: '0' }]);
  const [weightKg, setWeightKg] = useState('');
  const [zone, setZone] = useState<JapanPostZone>(5);

  const rates = getRates();

  const sellPrice = (row: ProductRow) => {
    const cost = parseFloat(row.costYen) || 0;
    const disc = Math.min(Math.max(parseFloat(row.discountPct) || 0, 0), 100);
    return cost * 2 * (1 - disc / 100);
  };

  const totalYen = useMemo(() => rows.reduce((s, r) => s + sellPrice(r), 0), [rows]);

  const addRow = () => {
    setRows(prev => [...prev, { id: nextId.current++, costYen: '', discountPct: '0' }]);
  };
  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof Omit<ProductRow, 'id'>, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const weightG = Math.round((parseFloat(weightKg) || 0) * 1000);
  const isLight = weightG > 0 && weightG <= 2000;
  const overLimit = weightG > 30000;
  const eRaitoYen = isLight ? getELightRate(weightG, zone) : null;
  const kAirYen = !isLight && weightG > 2000 && !overLimit ? getKozutsumiRate(weightG, zone, 'air') : null;
  const kSalYen = !isLight && weightG > 2000 && !overLimit ? getKozutsumiRate(weightG, zone, 'sal') : null;

  const yenFmt = (y: number) => `¥${Math.round(y).toLocaleString('ja-JP')}`;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Produtos ── */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">🛒 Produtos</h3>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* Cabeçalho das colunas */}
        <div className="grid grid-cols-[1fr_90px_1.6fr_20px] gap-2 mb-1 px-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Custo (¥)</span>
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Desconto</span>
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Preço de venda</span>
          <span />
        </div>

        <div className="space-y-2">
          {rows.map((row, idx) => {
            const sell = sellPrice(row);
            return (
              <div key={row.id} className="grid grid-cols-[1fr_90px_1.6fr_20px] gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">¥</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={row.costYen}
                    onChange={e => updateRow(row.id, 'costYen', e.target.value)}
                    className="pl-7 pr-2 py-2 rounded-lg border border-border bg-background text-sm w-full"
                  />
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={row.discountPct}
                    onChange={e => updateRow(row.id, 'discountPct', e.target.value)}
                    className="px-2 py-2 pr-6 rounded-lg border border-border bg-background text-sm w-full text-center"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
                <div className={`rounded-lg px-3 py-2 text-sm min-h-[38px] flex items-center ${sell > 0 ? 'bg-primary/8 border border-primary/20' : 'bg-secondary/30'}`}>
                  {sell > 0 ? (
                    <span>
                      <span className="font-black text-primary">{yenFmt(sell)}</span>
                      <span className="text-[11px] text-muted-foreground ml-1.5">
                        {formatPrice(sell * rates.BRL, 'BRL')} · {formatPrice(sell * rates.EUR, 'EUR')}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
                <button
                  onClick={() => rows.length > 1 && removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-20"
                  title="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Totais ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wide">Total em Ienes</p>
          <p className="text-2xl font-black text-amber-900 dark:text-amber-200">{yenFmt(totalYen)}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-bold text-green-700 dark:text-green-400 mb-1 uppercase tracking-wide">Total em Reais</p>
          <p className="text-2xl font-black text-green-900 dark:text-green-200">{formatPrice(totalYen * rates.BRL, 'BRL')}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-center">
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1 uppercase tracking-wide">Total em Euro</p>
          <p className="text-2xl font-black text-blue-900 dark:text-blue-200">{formatPrice(totalYen * rates.EUR, 'EUR')}</p>
        </div>
      </div>

      {/* ── Frete ── */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-bold text-lg flex items-center gap-2 mb-4">✈️ Frete Japan Post</h3>

        <div className="flex flex-wrap gap-4 mb-5">
          {/* Peso */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1 uppercase">Peso total</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                className="px-3 py-2 pr-9 rounded-lg border border-border bg-background text-sm w-36"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kg</span>
            </div>
          </div>

          {/* Destino */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1 uppercase">Destino</label>
            <div className="flex gap-2">
              {([5, 3] as JapanPostZone[]).map(z => (
                <button
                  key={z}
                  onClick={() => setZone(z)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${zone === z ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {z === 5 ? '🇧🇷 Brasil' : '🇪🇺 Europa'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados de frete */}
        {weightG === 0 && (
          <p className="text-sm text-muted-foreground">Digite o peso para ver as tarifas.</p>
        )}

        {overLimit && (
          <p className="text-sm text-red-500 font-semibold">⚠️ Peso excede o limite de 30 kg do Kozutsumi.</p>
        )}

        {isLight && eRaitoYen != null && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <span className="inline-block text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full mb-2">
              📦 e-Raito Light — até 2 kg
            </span>
            <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
              {yenFmt(eRaitoYen)}
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
              ≈ {formatPrice(eRaitoYen * rates.BRL, 'BRL')} · {formatPrice(eRaitoYen * rates.EUR, 'EUR')}
            </p>
          </div>
        )}

        {!isLight && !overLimit && weightG > 2000 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {kAirYen != null && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <span className="inline-block text-[10px] font-black text-blue-700 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full mb-2">
                  ✈️ Kozutsumi Aéreo
                </span>
                <p className="text-2xl font-black text-blue-800 dark:text-blue-200">{yenFmt(kAirYen)}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-0.5">
                  ≈ {formatPrice(kAirYen * rates.BRL, 'BRL')} · {formatPrice(kAirYen * rates.EUR, 'EUR')}
                </p>
              </div>
            )}
            {kSalYen != null && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <span className="inline-block text-[10px] font-black text-orange-700 bg-orange-100 dark:bg-orange-900 px-2 py-0.5 rounded-full mb-2">
                  🚢 Kozutsumi SAL — econômico
                </span>
                <p className="text-2xl font-black text-orange-800 dark:text-orange-200">{yenFmt(kSalYen)}</p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-0.5">
                  ≈ {formatPrice(kSalYen * rates.BRL, 'BRL')} · {formatPrice(kSalYen * rates.EUR, 'EUR')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminCalculator;
