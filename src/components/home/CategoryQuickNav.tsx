import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/context/ProductsContext';
import { categoryService, DEFAULT_CATEGORIES, type ProductCategory } from '@/services/categoryService';

/** Navegação rápida por categoria na home — cards clicáveis com contagem real de produtos. */
const CategoryQuickNav: React.FC = () => {
  const { products, loading } = useProducts();
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
    <section className="py-10 bg-white border-b border-gray-100">
      <div className="container mx-auto px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide sm:grid sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 sm:overflow-visible">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-24 sm:w-auto h-24 rounded-2xl bg-gray-100 animate-pulse" />
              ))
            : visibleCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/produtos/${cat.id}`}
                  className="group shrink-0 w-24 sm:w-auto flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-pink-50 hover:border-pink-200 p-3.5 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                  <span className="text-[11px] font-bold text-gray-700 text-center leading-tight line-clamp-1">
                    {cat.label}
                  </span>
                  <span className="text-[10px] text-pink-500 font-semibold">{counts[cat.id]} itens</span>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryQuickNav;
