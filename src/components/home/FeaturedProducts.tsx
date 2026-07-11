import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import CompactProductCard from '@/components/products/CompactProductCard';
import { useProducts } from '@/context/ProductsContext';
import { hasDiscount } from '@/utils/pricing';

type TabId = 'recomendado' | 'ofertas' | 'vendidos';

/**
 * Grade única de produtos com abas de filtro (estilo Temu: uma grade contínua
 * em vez de várias seções empilhadas com títulos/fundos diferentes).
 * As abas "Ofertas" e "Mais Vendidos" só aparecem quando há dados reais.
 */
const FeaturedProducts: React.FC = () => {
  const { products, loading } = useProducts();
  const [tab, setTab] = useState<TabId>('recomendado');

  // Produtos marcados como destaque pelo admin. Mostra no máx. 8 por vez;
  // se houver mais, a janela alterna a cada semana (rotação automática).
  const recomendados = useMemo(() => {
    const flagged = products
      .filter(p => !p.hidden && p.featured)
      .sort((a, b) => (a.featuredAt || '').localeCompare(b.featuredAt || ''));

    const pool = flagged.length > 0 ? flagged : products.filter(p => !p.hidden);
    if (pool.length <= 12) return pool;

    const weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const offset = (weeksSinceEpoch * 12) % pool.length;
    const result = [];
    for (let i = 0; i < 12; i++) result.push(pool[(offset + i) % pool.length]);
    return result;
  }, [products]);

  const ofertas = useMemo(
    () => products.filter(p => !p.hidden && hasDiscount(p)).slice(0, 12),
    [products]
  );

  const vendidos = useMemo(
    () =>
      products
        .filter(p => !p.hidden && (p.salesCount || 0) > 0)
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        .slice(0, 12),
    [products]
  );

  const tabs = [
    { id: 'recomendado' as TabId, label: 'Recomendado', icon: Sparkles, items: recomendados },
    ...(ofertas.length > 0 ? [{ id: 'ofertas' as TabId, label: 'Ofertas', icon: Zap, items: ofertas }] : []),
    ...(vendidos.length > 0 ? [{ id: 'vendidos' as TabId, label: 'Mais Vendidos', icon: TrendingUp, items: vendidos }] : []),
  ];

  const activeTab = tabs.find(t => t.id === tab) || tabs[0];
  const items = activeTab.items;

  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Produtos</h2>
          <Link to="/produtos" className="text-sm font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 shrink-0">
            Ver tudo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-colors',
                tab === id
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300 hover:text-pink-600'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {loading
            ? Array.from({ length: 12 }).map((_, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-square bg-secondary" />
                  <div className="p-2 space-y-2">
                    <div className="h-3 bg-secondary rounded w-4/5" />
                    <div className="h-4 bg-secondary rounded w-2/3" />
                  </div>
                </div>
              ))
            : items.map(product => <CompactProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
