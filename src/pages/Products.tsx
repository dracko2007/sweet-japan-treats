import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/products/ProductCard';
import { useProducts } from '@/context/ProductsContext';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';

const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const Products: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  const { t, selectedCountry } = useLanguage();
  const { products } = useProducts();
  const [query, setQuery] = useState('');

  // Cliente nunca vê produtos ocultos
  const visibleProducts = products.filter(p => !p.hidden);

  const byCategory = category && category !== 'all'
    ? visibleProducts.filter(p => p.category === category)
    : visibleProducts;

  const displayProducts = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return byCategory;
    return byCategory.filter(p =>
      normalize(p.name).includes(q) ||
      normalize(p.description).includes(q) ||
      normalize(p.flavor).includes(q)
    );
  }, [byCategory, query]);

  // Paginação do catálogo (12 por página)
  const { page, totalPages, pageItems, setPage, rangeStart, rangeEnd, total } =
    usePagination(displayProducts, 12);

  // Só mostra categorias que realmente têm produtos publicados
  const availableCategories = Array.from(new Set(visibleProducts.map(p => p.category)));
  const allCategories = [
    { id: 'cosmeticos', label: t('nav.products.cosmeticos'), href: '/produtos/cosmeticos' },
    { id: 'acessorios', label: t('nav.products.acessorios'), href: '/produtos/acessorios' },
    { id: 'doces', label: t('nav.products.doces'), href: '/produtos/doces' },
    { id: 'papelaria', label: t('nav.products.papelaria'), href: '/produtos/papelaria' },
    { id: 'eletronicos', label: t('nav.products.eletronicos'), href: '/produtos/eletronicos' },
    { id: 'masculino', label: t('nav.products.masculino'), href: '/produtos/masculino' },
    { id: 'vestuario', label: t('nav.products.vestuario'), href: '/produtos/vestuario' },
    { id: 'higiene', label: t('nav.products.higiene'), href: '/produtos/higiene' },
  ];
  const categories = [
    { id: 'all', label: t('productsPage.all') || 'Todos', href: '/produtos' },
    ...allCategories.filter(c => availableCategories.includes(c.id)),
  ];

  const currentCategory = category || 'all';

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {t('productsPage.title')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('productsPage.description')}
            </p>
          </div>

          {/* Barra de pesquisa */}
          <div className="max-w-xl mx-auto mt-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar produto por nome, sabor..."
                className="w-full pl-12 pr-11 py-3 rounded-full border border-border bg-card text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:outline-none transition"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-secondary text-muted-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={cat.href}
                className={cn(
                  "px-6 py-2.5 rounded-full font-medium text-sm transition-all",
                  currentCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {category && category !== 'all' && (
            <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-primary/10"
                )}>
                  {category === 'cosmeticos' ? '🧴' :
                   category === 'acessorios' ? '🎮' :
                   category === 'doces' ? '🍵' :
                   category === 'papelaria' ? '✏️' :
                   category === 'eletronicos' ? '📱' :
                   category === 'masculino' ? '👔' :
                   category === 'vestuario' ? '👕' :
                   category === 'higiene' ? '🧼' : '🌸'}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {category === 'cosmeticos' ? t('nav.products.cosmeticos') :
                     category === 'acessorios' ? t('nav.products.acessorios') :
                     category === 'doces' ? t('nav.products.doces') :
                     category === 'papelaria' ? t('nav.products.papelaria') :
                     category === 'eletronicos' ? t('nav.products.eletronicos') :
                     category === 'masculino' ? t('nav.products.masculino') :
                     category === 'vestuario' ? t('nav.products.vestuario') :
                     category === 'higiene' ? t('nav.products.higiene') : category}
                  </h2>
                  <p className="text-muted-foreground">
                    {category === 'cosmeticos' ? 'Os cosméticos, protetores solares e produtos de skin care mais famosos e tecnológicos do Japão.' : 
                     category === 'acessorios' ? 'Action figures originais de anime, luminárias kawaii e organizadores de design minimalista.' : 
                     category === 'doces' ? 'Doces finos de matcha, chás verdes tradicionais orgânicos e guloseimas exclusivas de Tóquio.' : 
                     category === 'papelaria' ? 'Canetas gel Sakura de fluxo suave e papelaria japonesa de alta durabilidade e estilo.' :
                     category === 'eletronicos' ? 'Gadgets, acessórios e eletrônicos japoneses com a qualidade e a tecnologia de ponta do Japão.' :
                     category === 'masculino' ? 'Produtos e cuidados pensados para o público masculino, com estilo e qualidade japonesa.' :
                     category === 'vestuario' ? 'Roupas e peças de vestuário com design e conforto japonês.' :
                     category === 'higiene' ? 'Produtos de higiene pessoal, cuidados e saúde com a qualidade japonesa.' :
                     'Confira nossa seleção exclusiva direto de Tóquio.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pageItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {displayProducts.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
              className="mt-12"
            />
          )}

          {displayProducts.length === 0 && (
            <div className="text-center py-16">
              {query ? (
                <p className="text-muted-foreground">
                  Nenhum produto encontrado para "<strong className="text-foreground">{query}</strong>".{' '}
                  <button onClick={() => setQuery('')} className="text-primary font-semibold hover:underline">Limpar busca</button>
                </p>
              ) : (
                <p className="text-muted-foreground">{t('productsPage.noProducts')}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Products;
