import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/context/ProductsContext';
import { categoryService, DEFAULT_CATEGORIES, type ProductCategory } from '@/services/categoryService';
import { useLanguage } from '@/context/LanguageContext';

/** Navegação rápida por categoria na home — cards clicáveis com contagem real de produtos. */
const CategoryQuickNav: React.FC = () => {
  const { products, loading } = useProducts();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
  }, []);

  const counts = products.reduce<Record<string, number>>((acc, p) => {
    if (p.hidden) return acc;
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  const visibleCategories = categories.filter((c) => counts[c.id] > 0);
  if (!loading && visibleCategories.length === 0) return null;

  return (
    <section className="relative overflow-hidden border-y border-pink-100/70 bg-gradient-to-b from-white via-pink-50/35 to-white py-6 sm:py-8">
      <div className="pointer-events-none absolute -right-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-pink-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-pink-100/15 blur-3xl" />
      <div className="container relative mx-auto px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-500">{t('featured.badge')}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t('nav.products')}</h2>
          </div>
          <span className="hidden text-xs font-medium text-slate-500 sm:block">{t('featured.subtitle')}</span>
        </div>

        <div className="flex gap-3 overflow-x-auto px-1 pb-3 pt-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[76px] w-36 shrink-0 animate-pulse rounded-2xl bg-gradient-to-br from-pink-50 to-pink-100" />
              ))
            : visibleCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/produtos/${cat.id}`}
                  className="group relative flex min-w-[148px] shrink-0 items-center gap-3 overflow-hidden rounded-2xl
                    border border-pink-100 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm
                    transition-all duration-300 hover:scale-105 hover:-translate-y-1
                    hover:border-pink-300 hover:bg-white hover:shadow-lg hover:shadow-pink-200/40
                    focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
                >
                  <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-pink-100/50 transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                    bg-gradient-to-br from-pink-50 to-pink-100 text-2xl shadow-md
                    ring-1 ring-pink-200/60 transition-all duration-300
                    group-hover:scale-110 group-hover:shadow-lg">
                    {cat.icon}
                  </span>
                  <span className="relative min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{cat.label}</span>
                    <span className="mt-1 block text-xs font-semibold text-pink-600">{counts[cat.id]} itens</span>
                  </span>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryQuickNav;
