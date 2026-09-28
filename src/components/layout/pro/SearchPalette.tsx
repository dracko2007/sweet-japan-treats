import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock, CornerDownLeft, Search, X } from 'lucide-react';
import { useProducts } from '@/context/ProductsContext';
import { useLanguage } from '@/context/LanguageContext';
import type { ProductCategory } from '@/services/categoryService';
import type { Product } from '@/types';
import { minEffectiveYen } from '@/utils/pricing';
import { productEnglishName } from '@/utils/productName';
import { safeStorage } from '@/utils/storage';
import { cn } from '@/lib/utils';
import { useEscape, useScrollLock } from './useScrollLock';
import { usePrice } from './usePrice';

const RECENT_KEY = 'sandbox_recent_searches';
const MAX_RECENT = 5;
const MAX_RESULTS = 6;

const normalize = (s?: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const loadRecent = (): string[] => {
  try {
    const parsed = JSON.parse(safeStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

/** Pontua relevância: prefixo do nome > nome > tag > descrição. 0 = não casa. */
const score = (p: Product, q: string) => {
  const name = normalize(p.name);
  if (name.startsWith(q)) return 4;
  if (name.includes(q)) return 3;
  if (p.tags?.some((t) => normalize(t).includes(q))) return 2;
  if (normalize(p.description).includes(q)) return 1;
  return 0;
};

/**
 * Destaca o trecho buscado no nome exibido. A comparação ignora acentos e
 * caixa (mesmo `normalize` da pontuação), então cada caractere normalizado é
 * mapeado de volta ao índice do texto original.
 */
const Highlight: React.FC<{ text: string; q: string }> = ({ text, q }) => {
  if (!q) return <>{text}</>;
  let norm = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalize(text[i]);
    for (let k = 0; k < n.length; k++) origin.push(i);
    norm += n;
  }
  const at = norm.indexOf(q);
  if (at < 0) return <>{text}</>;
  const start = origin[at];
  const end = origin[at + q.length - 1] + 1;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-pink-100 text-pink-700">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
  categories: ProductCategory[];
}

const SearchPalette: React.FC<Props> = ({ open, onClose, categories }) => {
  const { products } = useProducts();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const price = usePrice();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(loadRecent);

  useScrollLock(open);
  useEscape(open, onClose);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategory(null);
    setActive(0);
    setRecent(loadRecent());
  }, [open]);

  const q = normalize(query.trim());
  const results = useMemo(() => {
    if (!q && !category) return [];
    return products
      .filter((p) => !p.hidden && (!category || p.category === category))
      .map((p) => ({ p, s: q ? score(p, q) : 1 }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || (b.p.salesCount || 0) - (a.p.salesCount || 0))
      .slice(0, MAX_RESULTS)
      .map((r) => r.p);
  }, [products, q, category]);

  useEffect(() => setActive(0), [q, category]);

  // Sem busca digitada: mais vendidos como atalho ("Destaques").
  const trending = useMemo(
    () =>
      products
        .filter((p) => !p.hidden && (p.thumbnail || p.image))
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        .slice(0, 4),
    [products],
  );

  // Setas do teclado: mantém a opção ativa visível dentro da lista rolável.
  useEffect(() => {
    const id = results[active] ? `search-opt-${results[active].id}` : 'search-opt-all';
    document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  const pill = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 500, damping: 38 };

  const remember = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...recent.filter((r) => normalize(r) !== normalize(clean))].slice(0, MAX_RECENT);
    setRecent(next);
    safeStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const searchAll = (term = query) => {
    const clean = term.trim();
    remember(clean);
    const params = clean ? `?q=${encodeURIComponent(clean)}` : '';
    go(category ? `/produtos/${category}${params}` : `/produtos${params}`);
  };

  const openProduct = (p: Product) => {
    remember(query);
    go(`/produto/${p.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) openProduct(results[active]);
      else searchAll();
    }
  };

  const clearRecent = () => {
    setRecent([]);
    safeStorage.removeItem(RECENT_KEY);
    inputRef.current?.focus();
  };

  const showEmptyState = !q && !category;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-start justify-center px-3 pt-[8vh] sm:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
        >
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('navPro.search')}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-[0_30px_80px_-20px_rgba(157,23,77,0.45)]"
            initial={reduce ? false : { opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center gap-3 border-b border-pink-100 px-5">
              <Search className="h-5 w-5 shrink-0 text-pink-500" aria-hidden />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('navPro.searchPlaceholder')}
                aria-label={t('navPro.searchPlaceholder')}
                aria-activedescendant={results[active] ? `search-opt-${results[active].id}` : undefined}
                className="h-16 flex-1 bg-transparent text-base shadow-none outline-none ring-0 placeholder:text-slate-400 focus:shadow-none focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-pink-50 hover:text-pink-600"
                aria-label={t('navPro.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chips de categoria — filtram os resultados ao vivo */}
            <div className="flex gap-2 overflow-x-auto border-b border-pink-50 px-5 py-3 scrollbar-hide">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory((cur) => (cur === c.id ? null : c.id))}
                  className={cn(
                    'relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    category === c.id
                      ? 'border-transparent text-white'
                      : 'border-pink-100 bg-pink-50/60 text-slate-700 hover:border-pink-300 hover:bg-pink-50',
                  )}
                >
                  {category === c.id && (
                    <motion.span
                      layoutId="search-chip-pill"
                      className="absolute inset-0 rounded-full bg-pink-500 shadow-md shadow-pink-200"
                      transition={pill}
                      aria-hidden
                    />
                  )}
                  <span className="relative mr-1">{c.icon}</span>
                  <span className="relative">{c.label}</span>
                </button>
              ))}
            </div>

            <div className="max-h-[55vh] overflow-y-auto overscroll-contain p-2" data-lenis-prevent role="listbox">
              {showEmptyState && recent.length > 0 && (
                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t('navPro.recent')}</p>
                    <button type="button" onClick={clearRecent} className="text-xs font-semibold text-pink-600 hover:underline">
                      {t('navPro.clearRecent')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => searchAll(r)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-pink-100 hover:text-pink-700"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showEmptyState && trending.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t('navPro.highlights')}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {trending.map((p, i) => (
                      <motion.button
                        key={p.id}
                        type="button"
                        onClick={() => openProduct(p)}
                        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: reduce ? 0 : 0.05 + i * 0.05, duration: 0.25 }}
                        whileHover={reduce ? undefined : { y: -3 }}
                        className="group rounded-2xl border border-pink-100 bg-white p-2 text-left transition-shadow hover:shadow-lg hover:shadow-pink-100"
                      >
                        <span className="block aspect-square overflow-hidden rounded-xl bg-pink-50/50">
                          <img
                            src={p.thumbnail || p.image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-contain p-1.5 transition-transform duration-500 group-hover:scale-110"
                          />
                        </span>
                        <span className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-slate-700 group-hover:text-pink-700">
                          {productEnglishName(p)}
                        </span>
                        <span className="text-[11px] font-extrabold text-pink-600">{price(minEffectiveYen(p))}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {showEmptyState && recent.length === 0 && trending.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-slate-400">{t('navPro.searchPlaceholder')}</p>
              )}

              {!showEmptyState && results.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  {t('navPro.noResults')} <b className="text-slate-800">“{query.trim() || categories.find((c) => c.id === category)?.label}”</b>
                </p>
              )}

              <AnimatePresence mode="popLayout" initial={false}>
                {results.map((p, i) => (
                  <motion.button
                    key={p.id}
                    id={`search-opt-${p.id}`}
                    role="option"
                    aria-selected={i === active}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openProduct(p)}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                    transition={{ delay: reduce ? 0 : i * 0.03, duration: 0.2 }}
                    className="relative flex w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left"
                  >
                    {/* Seleção desliza entre as linhas (mouse e setas) */}
                    {i === active && (
                      <motion.span layoutId="search-active" className="absolute inset-0 rounded-2xl bg-pink-50" transition={pill} aria-hidden />
                    )}
                    <img
                      src={p.thumbnail || p.image}
                      alt=""
                      loading="lazy"
                      className="relative h-14 w-14 shrink-0 rounded-xl border border-pink-100 bg-white object-cover"
                    />
                    <span className="relative min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800">
                        <Highlight text={productEnglishName(p)} q={q} />
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {categories.find((c) => c.id === p.category)?.label || p.category}
                      </span>
                    </span>
                    <span className="relative max-w-[40%] shrink-0 text-right text-xs font-extrabold text-pink-600 sm:text-sm">{price(minEffectiveYen(p))}</span>
                    {i === active && <CornerDownLeft className="relative h-4 w-4 shrink-0 text-pink-400" aria-hidden />}
                  </motion.button>
                ))}
              </AnimatePresence>

              {!showEmptyState && (
                <motion.button
                  id="search-opt-all"
                  type="button"
                  layout={!reduce}
                  onClick={() => searchAll()}
                  onMouseEnter={() => setActive(results.length)}
                  className="group relative mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold text-pink-600"
                >
                  {active === results.length && (
                    <motion.span layoutId="search-active" className="absolute inset-0 rounded-2xl bg-pink-50" transition={pill} aria-hidden />
                  )}
                  <span className="relative">{t('navPro.seeAllResults')}</span>
                  <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </motion.button>
              )}
            </div>

            <div className="hidden items-center gap-4 border-t border-pink-50 bg-slate-50/70 px-5 py-2.5 text-[11px] text-slate-500 sm:flex">
              <span><kbd className="rounded border bg-white px-1.5 py-0.5 font-sans">↑</kbd> <kbd className="rounded border bg-white px-1.5 py-0.5 font-sans">↓</kbd> {t('navPro.hintNavigate')}</span>
              <span><kbd className="rounded border bg-white px-1.5 py-0.5 font-sans">Enter</kbd> {t('navPro.hintOpen')}</span>
              <span><kbd className="rounded border bg-white px-1.5 py-0.5 font-sans">Esc</kbd> {t('navPro.hintClose')}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default SearchPalette;
