import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ArrowRight, Heart, Share2, ShoppingCart } from 'lucide-react';
import { useProducts } from '@/context/ProductsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import { effectiveYen, baseYen, hasDiscount, getVariants } from '@/utils/pricing';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { convertYen as fxConvert } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';
import { i18nDesc } from '@/utils/productI18n';

interface CinematicPosterShelfProps {
  /** Chave de tradução base, ex: 'posterShelf.shampoo' -> usa .eyebrow/.title/.hint */
  i18nKey: string;
  /** Palavras-chave (tags/nome/descrição) que definem o que entra nesta seção. */
  keywords: string[];
  /** Palavra gigante decorativa ao fundo. */
  wordmark: string;
  /** Máximo de produtos exibidos. */
  max?: number;
}

/**
 * CinematicPosterShelf — catálogo estilo "pôster de filme" (referência: IMDb
 * redesign / Dune Part Two no Dribbble). Produtos em preto-e-branco por
 * padrão; passar o mouse revela a cor real, como uma tira de pôsteres de
 * cinema. Clicar amplia numa ficha técnica escura (shared layout via
 * `layoutId` — a mesma imagem "voa" do card até o painel). Fica logo depois
 * do hero cinematográfico em vídeo (que continua intacto, sem mudanças).
 */
const CinematicPosterShelf: React.FC<CinematicPosterShelfProps> = ({
  i18nKey,
  keywords,
  wordmark,
  max = 8,
}) => {
  const { products, loading } = useProducts();
  const { language, t, selectedCountry } = useLanguage();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const currency = getCurrencyByCountry(selectedCountry);

  const items = useMemo(
    () =>
      products
        .filter((p) => {
          if (p.hidden) return false;
          const haystack = [p.name, p.description, ...(p.tags || [])].join(' ').toLowerCase();
          return keywords.some((k) => haystack.includes(k.toLowerCase()));
        })
        .slice(0, max),
    [products, keywords, max],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((p) => p.id === selectedId) || null;
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    setDescExpanded(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [selected]);

  if (loading || items.length === 0) return null;

  const priceOf = (p: Product) => {
    const variant = [...getVariants(p)].sort((a, b) => a.price - b.price)[0];
    const size = variant?.id || 'small';
    return {
      price: fxConvert(effectiveYen(p, size), currency),
      original: fxConvert(baseYen(p, size), currency),
      discounted: hasDiscount(p),
    };
  };

  return (
    <section className="relative overflow-hidden bg-[#0b0708] py-16 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 75% 20%, rgba(219,39,119,0.18) 0%, transparent 60%), radial-gradient(50% 40% at 15% 80%, rgba(120,20,60,0.16) 0%, transparent 60%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-10 text-center md:mb-14">
          <span className="mb-2 block text-[10px] uppercase tracking-[0.35em] text-pink-300/80 md:text-xs">
            {t(`${i18nKey}.eyebrow`)}
          </span>
          <h2 className="mb-2 font-display text-2xl font-light text-white md:text-4xl">
            {t(`${i18nKey}.title`)}
          </h2>
          <p className="text-xs text-white/40 md:text-sm">{t(`${i18nKey}.hint`)}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3.5 md:gap-4">
          {items.map((p) => {
            const name = productEnglishName(p);
            const { price } = priceOf(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="group relative h-[210px] w-[130px] shrink-0 overflow-hidden rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:-translate-y-3 focus:outline-none md:h-[260px] md:w-[160px]"
                aria-label={name}
              >
                <motion.img
                  layoutId={`poster-img-${p.id}`}
                  src={p.thumbnail || p.image}
                  alt={name}
                  loading="lazy"
                  className="h-full w-full object-cover grayscale brightness-90 transition-[filter] duration-500 ease-out group-hover:grayscale-0 group-hover:brightness-100"
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-30" />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  {formatPrice(price, currency)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="pointer-events-none absolute -bottom-[4vw] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[16vw] leading-none text-white/[0.045] md:text-[11vw]"
        aria-hidden
      >
        {wordmark}
      </div>

      {/* Ficha técnica — a imagem "voa" do pôster até aqui via layoutId
          compartilhado; framer-motion calcula a transição (FLIP)
          automaticamente. Fechar reverte para a posição exata na tira. */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              className="relative flex w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a0f12] to-[#0d0708] shadow-2xl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>

              <motion.img
                layoutId={`poster-img-${selected.id}`}
                src={selected.image}
                alt={productEnglishName(selected)}
                className="hidden w-2/5 shrink-0 bg-white object-contain p-4 md:block"
              />

              <div className="flex-1 max-h-[90vh] overflow-y-auto p-7 md:p-9">
                <h3 className="mb-2 font-display text-2xl font-light text-white md:text-3xl">
                  {productEnglishName(selected)}
                </h3>
                <div className="mb-5 text-sm leading-relaxed text-white/60">
                  <div className={descExpanded ? "" : "line-clamp-4"}>
                    {i18nDesc(selected, language) || selected.description}
                  </div>
                  {String(i18nDesc(selected, language) || selected.description || '').length > 150 && (
                    <button 
                      onClick={() => setDescExpanded(!descExpanded)} 
                      className="text-pink-400 font-semibold text-xs mt-1 hover:underline focus:outline-none"
                    >
                      {descExpanded ? 'Ler menos' : 'Ler mais'}
                    </button>
                  )}
                </div>

                <div className="mb-5 flex flex-wrap gap-2">
                  {selected.weightGrams && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                      {t('posterShelf.weight')}: <b className="text-pink-300">{selected.weightGrams}g</b>
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                    {t('posterShelf.origin')}: <b className="text-pink-300">{t('posterShelf.originValue')}</b>
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                    {t('posterShelf.delivery')}: <b className="text-pink-300">{t('posterShelf.deliveryValue')}</b>
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-2">
                  <span className="font-display text-2xl text-white">
                    {formatPrice(priceOf(selected).price, currency)}
                  </span>
                  {priceOf(selected).discounted && (
                    <span className="text-sm text-white/40 line-through">
                      {formatPrice(priceOf(selected).original, currency)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const variant = [...getVariants(selected)].sort((a, b) => a.price - b.price)[0];
                      addToCart(selected, variant?.id || 'small', 1, variant?.label);
                      toast({ title: productEnglishName(selected), description: t('productDetail.addToCart') });
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
                  >
                    <Plus className="h-4 w-4" />
                    {t('productDetail.addToCart')}
                  </button>
                  <Link
                    to={`/produto/${selected.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
                  >
                    {t('posterShelf.viewFull')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    className="ml-auto rounded-full border border-white/15 p-2.5 text-white/70 transition-colors hover:bg-white/10"
                    aria-label="Favoritar"
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 p-2.5 text-white/70 transition-colors hover:bg-white/10"
                    aria-label="Compartilhar"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 p-2.5 text-white/70 transition-colors hover:bg-white/10"
                    aria-label="Carrinho"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default CinematicPosterShelf;
