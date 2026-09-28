import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import type { ProductCategory } from '@/services/categoryService';
import type { Product } from '@/types';
import { minEffectiveYen } from '@/utils/pricing';
import { productEnglishName } from '@/utils/productName';
import { usePrice } from './usePrice';

interface Props {
  id: string;
  categories: ProductCategory[];
  counts: Record<string, number>;
  /** Tags mais frequentes do catálogo — funcionam como subcategorias. */
  tags: string[];
  highlights: Product[];
  onNavigate: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const MegaMenu: React.FC<Props> = ({ id, categories, counts, tags, highlights, onNavigate, onMouseEnter, onMouseLeave }) => {
  const { t } = useLanguage();
  const price = usePrice();
  const reduce = useReducedMotion();
  const eyebrow = 'mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-pink-500';

  return (
    <motion.div
      id={id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="absolute inset-x-0 top-full border-b border-pink-100 bg-white shadow-[0_30px_60px_-30px_rgba(157,23,77,0.35)]"
    >
      <div className="container mx-auto grid gap-8 px-4 py-6 lg:grid-cols-[1fr_380px]">
        <div>
          <p className={eyebrow}>{t('navPro.shopByCategory')}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c, i) => (
              <motion.li
                key={c.id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 0.03 * i, duration: 0.2 }}
              >
                <Link
                  to={`/produtos/${c.id}`}
                  onClick={onNavigate}
                  className="group flex items-center gap-3 rounded-2xl border border-transparent p-2.5 transition-all hover:border-pink-100 hover:bg-pink-50/70"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-50 to-pink-100 text-xl ring-1 ring-pink-200/60 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    {c.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800 group-hover:text-pink-700">{c.label}</span>
                    <span className="block text-xs text-slate-500">{counts[c.id]} {t('navPro.items')}</span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>

          {tags.length > 0 && (
            <>
              <p className={`${eyebrow} mt-6`}>{t('navPro.popularTypes')}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <motion.span
                    key={tag}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: reduce ? 0 : 0.05 + 0.02 * i, duration: 0.18 }}
                  >
                    <Link
                      to={`/produtos?q=${encodeURIComponent(tag)}`}
                      onClick={onNavigate}
                      className="inline-block rounded-full border border-pink-100 bg-pink-50/60 px-3 py-1.5 text-xs font-semibold capitalize text-slate-700 transition-all hover:-translate-y-0.5 hover:border-pink-300 hover:bg-pink-100 hover:text-pink-700"
                    >
                      {tag}
                    </Link>
                  </motion.span>
                ))}
              </div>
            </>
          )}

          <Link to="/produtos" onClick={onNavigate} className="group mt-5 inline-flex items-center gap-2 text-sm font-bold text-pink-600">
            {t('navPro.allProducts')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>

        {highlights.length > 0 && (
          <div className="hidden lg:block">
            <p className={eyebrow}>{t('navPro.highlights')}</p>
            <div className="grid grid-cols-3 gap-3">
              {highlights.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.08 + 0.05 * i, duration: 0.25 }}
                >
                  <Link to={`/produto/${p.id}`} onClick={onNavigate} className="group block">
                    <span className="block aspect-[3/4] overflow-hidden rounded-2xl bg-pink-50 shadow-sm">
                      <img
                        src={p.thumbnail || p.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </span>
                    <span className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700 group-hover:text-pink-700">
                      {productEnglishName(p)}
                    </span>
                    <span className="text-xs font-extrabold text-pink-600">{price(minEffectiveYen(p))}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MegaMenu;
