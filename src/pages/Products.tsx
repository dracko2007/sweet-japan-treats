import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/products/ProductCard';
import { useProducts } from '@/context/ProductsContext';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';

const normalize = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type SortKey = 'az' | 'za' | 'vendidos' | 'lancamento';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'az',        label: 'A → Z' },
  { key: 'za',        label: 'Z → A' },
  { key: 'vendidos',  label: 'Mais Vendidos' },
  { key: 'lancamento', label: 'Lançamento' },
];

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  cosmeticos: { label: 'Cosméticos', icon: '🧴', desc: 'Os cosméticos, protetores solares e produtos de skin care mais famosos e tecnológicos do Japão.' },
  acessorios: { label: 'Acessórios', icon: '🎮', desc: 'Action figures originais de anime, luminárias kawaii e organizadores de design minimalista.' },
  doces:      { label: 'Doces & Chás', icon: '🍵', desc: 'Doces finos de matcha, chás verdes tradicionais orgânicos e guloseimas exclusivas de Tóquio.' },
  papelaria:  { label: 'Papelaria', icon: '✏️', desc: 'Canetas gel Sakura de fluxo suave e papelaria japonesa de alta durabilidade e estilo.' },
  eletronicos:{ label: 'Eletrônicos', icon: '📱', desc: 'Gadgets, acessórios e eletrônicos japoneses com a qualidade e a tecnologia de ponta do Japão.' },
  masculino:  { label: 'Masculino', icon: '👔', desc: 'Produtos e cuidados pensados para o público masculino, com estilo e qualidade japonesa.' },
  vestuario:  { label: 'Vestuário', icon: '👕', desc: 'Roupas e peças de vestuário com design e conforto japonês.' },
  higiene:    { label: 'Higiene & Saúde', icon: '🧼', desc: 'Produtos de higiene pessoal, cuidados e saúde com a qualidade japonesa.' },
};

const Products: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  const { t } = useLanguage();
  const { products } = useProducts();

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

  // 3) Filtra por busca
  const bySearch = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return byType;
    return byType.filter(p =>
      normalize(p.name).includes(q) ||
      normalize(p.description).includes(q) ||
      normalize(p.flavor).includes(q)
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
    return arr;
  }, [bySearch, sort]);

  const { page, totalPages, pageItems, setPage, rangeStart, rangeEnd, total } =
    usePagination(displayProducts, 12);

  // Categorias disponíveis (para filtro no /todos)
  const availableCats = useMemo(() =>
    Array.from(new Set(visible.map(p => p.category)))
      .filter(id => CATEGORY_META[id])
      .sort((a, b) => (CATEGORY_META[a]?.label || a).localeCompare(CATEGORY_META[b]?.label || b, 'pt')),
    [visible]);

  // Tipos disponíveis (tags) na categoria efetiva
  const availableTypes = useMemo(() => {
    if (!effectiveCat) return [];
    const set = new Set<string>();
    byCat.forEach(p => p.tags?.forEach(t => t && set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [byCat, effectiveCat]);

  // Categorias como nav links (compatibilidade com rotas existentes)
  const navCategories = [
    { id: 'all', label: t('productsPage.all') || 'Todos', href: '/produtos' },
    ...availableCats.map(id => ({
      id,
      label: CATEGORY_META[id]?.label || id,
      href: `/produtos/${id}`,
    })),
  ];
  const currentRoute = category || 'all';

  const hasActiveFilters = !!(sort || catFilter || typeFilter);
  const clearFilters = () => { setSort(null); setCatFilter(null); setTypeFilter(null); };

  const catMeta = effectiveCat ? CATEGORY_META[effectiveCat] : null;

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
                  placeholder="Pesquisar..."
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-full border border-border bg-card text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:outline-none transition"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-secondary text-muted-foreground" aria-label="Limpar busca">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-semibold transition-colors shrink-0",
                  hasActiveFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
                {hasActiveFilters && <span className="bg-white/30 text-[10px] px-1.5 py-0.5 rounded-full font-bold">●</span>}
                <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
              </button>
            </div>
          </div>

          {/* ── Painel de Filtros Avançados (recolhido por padrão) ── */}
          <div className="max-w-3xl mx-auto mt-3">
            <div className={cn("space-y-3", !filtersOpen && "hidden")}>

              {/* Ordenar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-20 shrink-0">Ordenar</span>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSort(sort === opt.key ? null : opt.key); setPage(1); }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                        sort === opt.key
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro por categoria — só na rota /todos */}
              {isAllRoute && availableCats.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-20 shrink-0">Categoria</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setCatFilter(null); setPage(1); }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                        !catFilter
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      Todas
                    </button>
                    {availableCats.map(id => (
                      <button
                        key={id}
                        onClick={() => { setCatFilter(catFilter === id ? null : id); setPage(1); }}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                          catFilter === id
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                        )}
                      >
                        {CATEGORY_META[id]?.icon} {CATEGORY_META[id]?.label || id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtro por tipo — dinâmico, só aparece quando há tags na categoria atual */}
              {availableTypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-20 shrink-0">Tipo</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setTypeFilter(null); setPage(1); }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                        !typeFilter
                          ? "bg-secondary text-foreground border-foreground/20 shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      Todos
                    </button>
                    {availableTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => { setTypeFilter(typeFilter === type ? null : type); setPage(1); }}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all capitalize",
                          typeFilter === type
                            ? "bg-secondary text-foreground border-foreground/20 shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Limpar filtros */}
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* Banner da categoria atual */}
          {catMeta && (
            <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-primary/10">
                  {catMeta.icon}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">{catMeta.label}</h2>
                  <p className="text-muted-foreground">{catMeta.desc}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resumo do filtro ativo */}
          {hasActiveFilters && (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Filtros ativos:</span>
              {sort && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {SORT_OPTIONS.find(o => o.key === sort)?.label}
                  <button onClick={() => setSort(null)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {catFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {CATEGORY_META[catFilter]?.icon} {CATEGORY_META[catFilter]?.label || catFilter}
                  <button onClick={() => setCatFilter(null)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-semibold capitalize">
                  {typeFilter}
                  <button onClick={() => setTypeFilter(null)}><X className="w-3 h-3" /></button>
                </span>
              )}
              <span className="text-xs">— {total} produto{total !== 1 ? 's' : ''}</span>
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
        </div>
      </section>
    </Layout>
  );
};

export default Products;
