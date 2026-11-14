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
  // Com uma categoria só, o bloco repete o grid de produtos logo abaixo e
  // parece inacabado (um card solitário). Só mostra quando há escolha real.
  // Nada de skeleton enquanto carrega: evita um bloco que aparece e some.
  if (loading || visibleCategories.length < 2) return null;

  return (
    <section className="relative overflow-hidden border-y border-pink-100/70 bg-gradient-to-b from-white via-pink-50/35 to-white py-6 sm:py-8">
      <div className="container relative mx-auto px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-500">{t('featured.badge')}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t('nav.products')}</h2>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto px-1 pb-3 pt-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
          {visibleCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/produtos/${cat.id}`}
                  className="group relative flex min-w-[148px] shrink-0 items-center gap-3 overflow-hidden rounded-2xl
                    border border-pink-100 bg-white px-4 py-3 shadow-sm
                    transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5
                    hover:border-pink-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0
                    focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
                >
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl
                    bg-gradient-to-br from-pink-50 to-pink-100 text-2xl shadow-md
                    ring-1 ring-pink-200/60">
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
