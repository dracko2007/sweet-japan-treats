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
    <section className="py-4 bg-white border-b border-gray-100">
      <div className="container mx-auto px-4">
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide sm:flex-wrap sm:justify-center sm:overflow-visible">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 h-10 w-28 rounded-full bg-gray-100 animate-pulse" />
              ))
            : visibleCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/produtos/${cat.id}`}
                  className="group shrink-0 flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 hover:bg-pink-50 hover:border-pink-200 px-4 py-2 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">{cat.icon}</span>
                  <span className="text-xs font-bold text-gray-700 leading-none whitespace-nowrap">
                    {cat.label}
                  </span>
                  <span className="text-[10px] text-pink-500 font-semibold leading-none whitespace-nowrap">
                    {counts[cat.id]}
                  </span>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryQuickNav;
