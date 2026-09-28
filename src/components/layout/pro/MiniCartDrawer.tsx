import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Gift, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { getMaxQty, useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { effectiveYen } from '@/utils/pricing';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { convertYen } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';
import { useEscape, useScrollLock } from './useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Cascata dos itens só na abertura; itens adicionados depois entram sem atraso. */
const LIST_VARIANTS = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } } };
const ITEM_VARIANTS = { hidden: { opacity: 0, x: 24 }, show: { opacity: 1, x: 0, transition: { duration: 0.22 } } };

/** Carrinho lateral (flyout) — confirma a adição sem tirar o cliente da página. */
const MiniCartDrawer: React.FC<Props> = ({ open, onClose }) => {
  const { items, updateQuantity, removeFromCart, totalItems } = useCart();
  const { t, selectedCountry } = useLanguage();
  const reduce = useReducedMotion();
  const currency = getCurrencyByCountry(selectedCountry);

  useScrollLock(open);
  useEscape(open, onClose);

  // Toque: arrastar o painel para a direita fecha (padrão de gaveta em app).
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  // Mesma conta do CartItem: converte o unitário e multiplica (brindes não somam).
  const subtotal = items.reduce(
    (sum, i) => (i.freeGift ? sum : sum + convertYen(effectiveYen(i.product, i.size), currency) * i.quantity),
    0,
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000]">
          <motion.div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t('navPro.cartTitle')}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-20px_0_60px_-20px_rgba(157,23,77,0.35)]"
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag={touch && !reduce ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 110 || info.velocity.x > 600) onClose();
            }}
          >
            <header className="flex items-center justify-between border-b border-pink-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <ShoppingBag className="h-5 w-5 text-pink-500" aria-hidden />
                {t('navPro.cartTitle')}
                {totalItems > 0 && (
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">{totalItems}</span>
                )}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition-[color,background-color,transform] duration-300 hover:rotate-90 hover:bg-pink-50 hover:text-pink-600"
                aria-label={t('navPro.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <motion.div
                  initial={reduce ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-50"
                >
                  <ShoppingBag className="h-9 w-9 text-pink-400" aria-hidden />
                </motion.div>
                <p className="font-semibold text-slate-700">{t('navPro.cartEmpty')}</p>
                <Link
                  to="/produtos"
                  onClick={onClose}
                  className="rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-200 transition-transform hover:scale-105"
                >
                  {t('navPro.cartEmptyCta')}
                </Link>
              </div>
            ) : (
              <>
                <motion.ul
                  className="flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-5 py-4"
                  data-lenis-prevent
                  variants={LIST_VARIANTS}
                  initial={reduce ? false : 'hidden'}
                  animate="show"
                >
                  <AnimatePresence>
                    {items.map((item) => {
                      const unit = convertYen(effectiveYen(item.product, item.size), currency);
                      const atMax = item.quantity >= getMaxQty(item.product);
                      return (
                        <motion.li
                          key={`${item.product.id}-${item.size}-${item.freeGift ? 'gift' : 'paid'}`}
                          layout={!reduce}
                          variants={ITEM_VARIANTS}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, x: 60, height: 0, marginTop: 0 }}
                          transition={{ duration: 0.22 }}
                          className="flex gap-3 rounded-2xl border border-pink-100 bg-white p-3"
                        >
                          <Link to={`/produto/${item.product.id}`} onClick={onClose} className="shrink-0">
                            <img
                              src={item.product.thumbnail || item.product.image}
                              alt=""
                              className="h-20 w-20 rounded-xl bg-pink-50 object-cover"
                            />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <Link
                              to={`/produto/${item.product.id}`}
                              onClick={onClose}
                              className="line-clamp-2 text-sm font-semibold text-slate-800 hover:text-pink-600"
                            >
                              {productEnglishName(item.product)}
                            </Link>
                            {item.variantLabel && <span className="mt-0.5 text-xs text-slate-500">{item.variantLabel}</span>}
                            <div className="mt-auto flex items-center justify-between pt-2">
                              {item.freeGift ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                                  <Gift className="h-3.5 w-3.5" aria-hidden /> {t('navPro.gift')}
                                </span>
                              ) : (
                                <div className="flex items-center rounded-full border border-pink-100">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.product.id, item.size, item.quantity - 1)}
                                    className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-pink-50"
                                    aria-label="−1"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.product.id, item.size, item.quantity + 1)}
                                    disabled={atMax}
                                    className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-pink-50 disabled:opacity-30"
                                    aria-label="+1"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {!item.freeGift && (
                                  <span className="text-sm font-extrabold text-pink-600">
                                    {formatPrice(unit * item.quantity, currency)}
                                  </span>
                                )}
                                {!item.freeGift && (
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(item.product.id, item.size)}
                                    className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                    aria-label={t('navPro.remove')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </motion.ul>

                <footer className="space-y-3 border-t border-pink-100 bg-gradient-to-b from-white to-pink-50/60 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-600">{t('navPro.subtotal')}</span>
                    <motion.span
                      key={subtotal}
                      initial={reduce ? false : { scale: 1.15, color: '#db2777' }}
                      animate={{ scale: 1, color: '#0f172a' }}
                      className="text-xl font-black"
                    >
                      {formatPrice(subtotal, currency)}
                    </motion.span>
                  </div>
                  {/* O /checkout depende do carrinho (cupom + convidado/conta no
                      state da navegação), então o CTA principal passa por lá. */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="whitespace-nowrap rounded-full border border-pink-200 bg-white px-3 py-3 text-center text-xs font-bold text-pink-600 transition-colors hover:bg-pink-50 sm:text-sm"
                    >
                      {t('cart.continueShopping')}
                    </button>
                    <Link
                      to="/carrinho"
                      onClick={onClose}
                      className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-pink-200 transition-transform hover:scale-[1.02]"
                    >
                      {t('navPro.checkout')}
                    </Link>
                  </div>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default MiniCartDrawer;
