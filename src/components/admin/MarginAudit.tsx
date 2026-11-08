import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/context/ProductsContext';
import { minEffectiveYen } from '@/utils/pricing';
import { TrendingDown, AlertTriangle, CheckCircle, Search, CircleDollarSign, List, Pencil } from 'lucide-react';
import type { Product } from '@/types';

// Margem alvo: lucro deve ser >= 50% do PREÇO DE VENDA (markup 100% = custo×2).
const TARGET_MARGIN = 0.5;

interface Row {
  product: Product;
  costYen: number;
  priceYen: number;
  profitYen: number;
  marginPct: number;     // lucro / preço de venda
  belowTarget: boolean;
  hasCost: boolean;
}

type Filter = 'problems' | 'noCost' | 'all';

const MarginAudit: React.FC = () => {
  const { adminProducts: products } = useProducts();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('problems');

  const rows = useMemo<Row[]>(() => {
    return products.map(p => {
      const costYen = Number(p.cost) || 0;
      const priceYen = minEffectiveYen(p);
      const profitYen = priceYen - costYen;
      const marginPct = priceYen > 0 ? profitYen / priceYen : 0;
      return {
        product: p,
        costYen,
        priceYen,
        profitYen,
        marginPct,
        hasCost: costYen > 0,
        // Só marca como problema quando há custo cadastrado e a margem fica abaixo de 50%
        belowTarget: costYen > 0 && priceYen > 0 && marginPct < TARGET_MARGIN,
      };
    }).sort((a, b) => a.marginPct - b.marginPct); // pior margem primeiro
  }, [products]);

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.product.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'problems' ? r.belowTarget : filter === 'noCost' ? !r.hasCost : true;
    return matchSearch && matchFilter;
  });
  // Sem custo não tem margem para ordenar: em ordem alfabética fica mais fácil de achar.
  if (filter === 'noCost') filtered.sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'));

  const filterButton = (value: Filter, label: string, icon: React.ReactNode, active: string) => (
    <button
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
        filter === value ? active : 'border-border text-muted-foreground hover:bg-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const problemCount = rows.filter(r => r.belowTarget).length;
  const noCostCount = rows.filter(r => !r.hasCost).length;
  const okCount = rows.filter(r => r.hasCost && !r.belowTarget).length;

  const yen = (v: number) => `¥${Math.round(v).toLocaleString('ja-JP')}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingDown className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Auditoria de Margem</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Verifica se algum produto tem lucro abaixo de <strong>50% do preço de venda</strong>
        (ideal: preço = custo × 2). Produtos sem custo cadastrado não entram no cálculo.
      </p>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button type="button" onClick={() => setFilter('problems')} className={`bg-red-50 dark:bg-red-950/20 border rounded-xl p-4 text-center transition-shadow hover:shadow-md ${filter === 'problems' ? 'border-red-500 ring-2 ring-red-500/30' : 'border-red-200'}`}>
          <p className="text-2xl font-bold text-red-600">{problemCount}</p>
          <p className="text-xs text-muted-foreground">Abaixo de 50%</p>
        </button>
        <button type="button" onClick={() => setFilter('all')} className={`bg-green-50 dark:bg-green-950/20 border rounded-xl p-4 text-center transition-shadow hover:shadow-md ${filter === 'all' ? 'border-green-500 ring-2 ring-green-500/30' : 'border-green-200'}`}>
          <p className="text-2xl font-bold text-green-600">{okCount}</p>
          <p className="text-xs text-muted-foreground">Margem OK</p>
        </button>
        <button type="button" onClick={() => setFilter('noCost')} className={`bg-secondary/40 border rounded-xl p-4 text-center transition-shadow hover:shadow-md ${filter === 'noCost' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-border'}`}>
          <p className="text-2xl font-bold">{noCostCount}</p>
          <p className="text-xs text-muted-foreground">Sem custo cadastrado</p>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>
        {filterButton('problems', 'Só abaixo de 50%', <AlertTriangle className="w-3.5 h-3.5" />, 'bg-red-500 text-white border-red-500')}
        {filterButton('noCost', `Sem custo (${noCostCount})`, <CircleDollarSign className="w-3.5 h-3.5" />, 'bg-amber-500 text-white border-amber-500')}
        {filterButton('all', 'Todos', <List className="w-3.5 h-3.5" />, 'bg-primary text-primary-foreground border-primary')}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
          <CheckCircle className="w-10 h-10 text-green-500" />
          {filter === 'problems' ? 'Nenhum produto com margem abaixo de 50%! 🎉'
            : filter === 'noCost' ? 'Todos os produtos têm custo cadastrado! 🎉'
            : 'Nenhum produto encontrado.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Link
              key={r.product.id}
              to={`/admin?aba=products&editar=${encodeURIComponent(r.product.id)}`}
              title="Abrir a edição do produto"
              className={`group flex items-center gap-3 rounded-xl border p-3 transition-shadow hover:shadow-md hover:border-primary/50 ${
                r.belowTarget ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10'
                : !r.hasCost ? 'border-border bg-secondary/20'
                : 'border-border'
              }`}
            >
              {(r.product.thumbnail || r.product.image) && (
                <img src={r.product.thumbnail || r.product.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {r.product.name}
                  {r.product.hidden && (
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase text-muted-foreground border border-border rounded px-1 py-px">oculto</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                  <span>Custo: {r.hasCost ? yen(r.costYen) : '—'}</span>
                  <span>Venda: {yen(r.priceYen)}</span>
                  {r.hasCost && <span>Lucro: {yen(r.profitYen)}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                {r.hasCost ? (
                  <span className={`text-sm font-bold ${r.belowTarget ? 'text-red-600' : 'text-green-600'}`}>
                    {(r.marginPct * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 font-medium">sem custo</span>
                )}
                {r.belowTarget && (
                  <p className="text-[10px] text-red-500">
                    sugerido: {yen(r.costYen * 2)}
                  </p>
                )}
              </div>
              <Pencil className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarginAudit;
