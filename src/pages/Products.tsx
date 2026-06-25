import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/products/ProductCard';
import { useProducts } from '@/context/ProductsContext';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';
import { minEffectiveYen } from '@/utils/pricing';

const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type SortKey = 'az' | 'za' | 'vendidos' | 'lancamento' | 'preco-menor' | 'preco-maior';

const SORT_KEYS: SortKey[] = ['az', 'za', 'vendidos', 'lancamento'];

const CATEGORY_ICONS: Record<string, string> = {
  cosmeticos: '🧴', acessorios: '🎮', doces: '🍵', papelaria: '✏️',
  eletronicos: '📱', masculino: '👔', vestuario: '👕', higiene: '🧼',
};

const Products: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  const { t, language } = useLanguage();

  const SORT_OPTIONS = [
    { key: 'preco-menor' as SortKey, label: t('productsPage.sortPriceAsc') || 'Menor preço' },
    { key: 'preco-maior' as SortKey, label: t('productsPage.sortPriceDesc') || 'Maior preço' },
    { key: 'az' as SortKey,         label: t('productsPage.sortAZ') },
    { key: 'za' as SortKey,         label: t('productsPage.sortZA') },
    { key: 'vendidos' as SortKey,   label: t('productsPage.sortBestseller') },
    { key: 'lancamento' as SortKey, label: t('productsPage.sortNew') },
  ];

  const getCategoryLabel = (id: string) => t(`product.category.${id}`) || id;
  const getCategoryDesc = (id: string) => {
    const descs: Record<string, Record<string, string>> = {
      pt: {
        cosmeticos: 'Os cosméticos, protetores solares e produtos de skin care mais famosos do Japão.',
        acessorios: 'Action figures originais de anime, luminárias kawaii e organizadores minimalistas.',
        doces: 'Doces finos de matcha, chás verdes tradicionais orgânicos e guloseimas de Tóquio.',
        papelaria: 'Canetas gel Sakura de fluxo suave e papelaria japonesa de alta durabilidade.',
        eletronicos: 'Gadgets, acessórios e eletrônicos japoneses com tecnologia de ponta.',
        masculino: 'Produtos pensados para o público masculino com estilo e qualidade japonesa.',
        vestuario: 'Roupas e peças com design e conforto japonês.',
        higiene: 'Produtos de higiene pessoal e saúde com a qualidade japonesa.',
      },
      en: {
        cosmeticos: 'The most famous Japanese cosmetics, sunscreens and skincare products.',
        acessorios: 'Original anime figures, kawaii lamps and minimalist organizers.',
        doces: 'Premium matcha sweets, organic green teas and Tokyo exclusive treats.',
        papelaria: 'Smooth-flow Sakura gel pens and durable Japanese stationery.',
        eletronicos: 'Japanese gadgets, accessories and electronics with cutting-edge tech.',
        masculino: 'Products designed for men with Japanese style and quality.',
        vestuario: 'Clothing with Japanese design and comfort.',
        higiene: 'Personal care and health products with Japanese quality.',
      },
      ja: {
        cosmeticos: '日本の人気コスメ・日焼け止め・スキンケア製品。',
        acessorios: 'アニメオリジナルフィギュア、かわいいランプ、ミニマルオーガナイザー。',
        doces: '抹茶スイーツ・有機緑茶・東京限定おやつ。',
        papelaria: 'サクラのゲルペンと高品質の日本文房具。',
        eletronicos: '最先端技術の日本製ガジェット・アクセサリー・電子機器。',
        masculino: '日本品質のメンズケア商品。',
        vestuario: '日本デザインの快適なウェア。',
        higiene: '日本品質の衛生・健康ケア商品。',
      },
    };
    return descs[language]?.[id] || descs['pt'][id] || '';
  };
  const { products, loading } = useProducts();

  const [query,      setQuery]      = useState('');
  const [sort,       setSort]       = useState<SortKey | null>(null);
  const [catFilter,  setCatFilter]  = useState<string | null>(null); // só em /todos
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Reset type filter when category changes (route or catFilter)
  useEffect(() => { setTypeFilter(null); }, [category, catFilter]);
  // Reset catFilter when navigating to a specific category
  useEffect(() => { if (category && category !== 'all') setCatFilter(null); }, [category]);

  const isAllRoute = !category || category === 'all';

  // Produtos visíveis (nunca mostra ocultos)
  const visible = useMemo(() => products.filter(p => !p.hidden), [products]);

  // Categoria efetiva: rota sobrepõe filtro do painel
  const effectiveCat = isAllRoute ? catFilter : category;

  // 1) Filtra por categoria
  const byCat = useMemo(() =>
    effectiveCat ? visible.filter(p => p.category === effectiveCat) : visible,
    [visible, effectiveCat]);

  // 2) Filtra por tipo/tag
  const byType = useMemo(() =>
    typeFilter ? byCat.filter(p => p.tags?.includes(typeFilter)) : byCat,
    [byCat, typeFilter]);

  // 3) Filtra por busca (nome, descrição, sabor e tags)
  const bySearch = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return byType;
    return byType.filter(p =>
      normalize(p.name).includes(q) ||
      normalize(p.description).includes(q) ||
      normalize(p.flavor).includes(q) ||
      p.tags?.some(tag => normalize(tag).includes(q))
    );
  }, [byType, query]);

  // 4) Ordena
  const displayProducts = useMemo(() => {
    if (!sort) return bySearch;
    const arr = [...bySearch];
    if (sort === 'az') arr.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    if (sort === 'za') arr.sort((a, b) => b.name.localeCompare(a.name, 'pt'));
    if (sort === 'vendidos') arr.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    if (sort === 'lancamento') arr.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    if (sort === 'preco-menor') arr.sort((a, b) => minEffectiveYen(a) - minEffectiveYen(b));
    if (sort === 'preco-maior') arr.sort((a, b) => minEffectiveYen(b) - minEffectiveYen(a));
    return arr;
  }, [bySearch, sort]);

  const { page, totalPages, pageItems, setPage, rangeStart, rangeEnd, total } =
    usePagination(displayProducts, 12);

  const availableCats = useMemo(() =>
    Array.from(new Set(visible.map(p => p.category)))
      .filter(id => CATEGORY_ICONS[id])
      .sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b))),
    [visible, language]);

  // Tipos disponíveis (tags) — mostra sempre que existam tags na lista atual
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    byCat.forEach(p => p.tags?.forEach(t => t && set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [byCat]);

  // Categorias como nav links (compatibilidade com rotas existentes)
  const navCategories = [
    { id: 'all', label: t('productsPage.all'), href: '/produtos' },
    ...availableCats.map(id => ({
      id,
      label: getCategoryLabel(id),
      href: `/produtos/${id}`,
    })),
  ];
  const currentRoute = category || 'all';

  const hasActiveFilters = !!(sort || catFilter || typeFilter);
  const clearFilters = () => { setSort(null); setCatFilter(null); setTypeFilter(null); };

  // Fecha o dropdown de filtros ao clicar fora
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [filtersOpen]);

  const catMeta = effectiveCat ? { icon: CATEGORY_ICONS[effectiveCat] || '🛍️', label: getCategoryLabel(effectiveCat), desc: getCategoryDesc(effectiveCat) } : null;

  return (
    <Layout>
      <div className="gradient-hero py-10">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-2">
              {t('productsPage.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('productsPage.description')}
            </p>
          </div>

          {/* Toolbar compacta: categorias + busca + botão de filtros */}
          <div className="mt-6 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap gap-2 flex-1 justify-center lg:justify-start">
              {navCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={cat.href}
                  onClick={() => { setQuery(''); setPage(1); }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full font-medium text-xs transition-all",
                    currentRoute === cat.id
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {cat.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-center">
              <div className="relative w-full sm:w-52">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder={t('productsPage.search')}
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-full border border-border bg-card text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:outline-none transition"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-secondary text-muted-foreground" aria-label="Limpar busca">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setFiltersOpen(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-semibold transition-colors shrink-0",
                    hasActiveFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('productsPage.filters')}</span>
                  {hasActiveFilters && <span className="bg-white/30 text-[10px] px-1.5 py-0.5 rounded-full font-bold">●</span>}
                  <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
                </button>

                {/* Lista suspensa de filtros */}
                {filtersOpen && (
                  <div className="absolute right-0 top-full mt-2 z-40 w-[min(20rem,88vw)] max-h-[70vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-elevated p-4 space-y-4 text-left">
                    {/* Ordenar */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{t('productsPage.sort')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SORT_OPTIONS.map(opt => (
                          <button key={opt.key} onClick={() => { setSort(sort === opt.key ? null : opt.key); setPage(1); }}
                            className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                              sort === opt.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Categoria — só na rota /todos */}
                    {isAllRoute && availableCats.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{t('productsPage.categoryFilter')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => { setCatFilter(null); setPage(1); }}
                            className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                              !catFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
                            {t('productsPage.allCategories')}
                          </button>
                          {availableCats.map(id => (
                            <button key={id} onClick={() => { setCatFilter(catFilter === id ? null : id); setPage(1); }}
                              className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                                catFilter === id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
                              {CATEGORY_ICONS[id]} {getCategoryLabel(id)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tipo — dinâmico */}
                    {availableTypes.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{t('productsPage.typeFilter')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => { setTypeFilter(null); setPage(1); }}
                            className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                              !typeFilter ? "bg-secondary text-foreground border-foreground/20" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
                            {t('productsPage.allTypes')}
                          </button>
                          {availableTypes.map(type => (
                            <button key={type} onClick={() => { setTypeFilter(typeFilter === type ? null : type); setPage(1); }}
                              className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize",
                                typeFilter === type ? "bg-secondary text-foreground border-foreground/20" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limpar */}
                    {hasActiveFilters && (
                      <button onClick={clearFilters}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold pt-1 border-t border-border w-full justify-center">
                        <X className="w-3.5 h-3.5" /> {t('productsPage.clearFilters')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          {/* Banner da categoria atual (compacto) */}
          {catMeta && (
            <div className="mb-6 p-3.5 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-primary/10 shrink-0">
                  {catMeta.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-foreground leading-tight">{catMeta.label}</h2>
                  <p className="text-xs text-muted-foreground line-clamp-1">{catMeta.desc}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resumo do filtro ativo */}
          {hasActiveFilters && (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('productsPage.activeFilters')}</span>
              {sort && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {SORT_OPTIONS.find(o => o.key === sort)?.label}
                  <button onClick={() => setSort(null)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {catFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {CATEGORY_ICONS[catFilter]} {getCategoryLabel(catFilter)}
                  <button onClick={() => setCatFilter(null)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-semibold capitalize">
                  {typeFilter}
                  <button onClick={() => setTypeFilter(null)}><X className="w-3 h-3" /></button>
                </span>
              )}
              <span className="text-xs">— {total} {total !== 1 ? t('productsPage.products_plural') : t('productsPage.products')}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                  <div className="aspect-square bg-secondary" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-secondary rounded w-4/5" />
                    <div className="h-3 bg-secondary rounded w-full" />
                    <div className="h-3 bg-secondary rounded w-2/3" />
                    <div className="h-8 bg-secondary rounded-lg w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5">
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
              {query || hasActiveFilters ? (
                <div>
                  <p className="text-muted-foreground mb-3">
                    {query
                      ? <>Nenhum produto encontrado para "<strong className="text-foreground">{query}</strong>".</>
                      : 'Nenhum produto com esses filtros.'}
                  </p>
                  <button
                    onClick={() => { setQuery(''); clearFilters(); }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Limpar busca e filtros
                  </button>
                </div>
              ) : (
                <p className="text-muted-foreground">{t('productsPage.noProducts')}</p>
              )}
            </div>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Products;
