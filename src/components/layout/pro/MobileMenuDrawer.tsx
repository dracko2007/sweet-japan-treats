import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Heart, UserCircle, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import type { ProductCategory } from '@/services/categoryService';
import CountrySwitcher from '@/components/CountrySwitcher';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { useEscape, useScrollLock } from './useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  counts: Record<string, number>;
  links: { label: string; href: string }[];
  isActive: (href: string) => boolean;
}

/** Cascata das listas na abertura (categorias e depois os links). */
const LIST_VARIANTS = {
  hidden: {},
  show: (delay = 0.05) => ({ transition: { staggerChildren: 0.03, delayChildren: delay } }),
};
const ITEM_VARIANTS = { hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } };

const MobileMenuDrawer: React.FC<Props> = ({ open, onClose, categories, counts, links, isActive }) => {
  const { t } = useLanguage();
  const { isAuthenticated, user, isAdmin } = useUser();
  const reduce = useReducedMotion();

  useScrollLock(open);
  useEscape(open, onClose);

  // Toque: arrastar o painel para a esquerda fecha (espelho do carrinho).
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] md:hidden">
          <motion.div
            className="absolute inset-0 bg-slate-950/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          />
          <motion.nav
            aria-label={t('navPro.menu')}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl"
            initial={reduce ? { opacity: 0 } : { x: '-100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag={touch && !reduce ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.7, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -110 || info.velocity.x < -600) onClose();
            }}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-pink-600 via-primary to-fuchsia-600 px-5 py-4 text-white">
              <Link
                to={isAuthenticated ? '/perfil' : '/cadastro'}
                onClick={onClose}
                className="flex items-center gap-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <UserCircle className="h-6 w-6" aria-hidden />
                </span>
                <span className="font-bold">
                  {isAuthenticated ? user?.name?.split(' ')[0] || t('nav.profile') : t('nav.register')}
                </span>
              </Link>
              <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/15" aria-label={t('navPro.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 touch-pan-y overflow-y-auto overscroll-contain" data-lenis-prevent>
              <p className="px-5 pb-2 pt-5 text-[11px] font-black uppercase tracking-[0.18em] text-pink-500">
                {t('navPro.shopByCategory')}
              </p>
              <motion.ul className="px-3" variants={LIST_VARIANTS} initial={reduce ? false : 'hidden'} animate="show">
                {categories.map((c) => (
                  <motion.li key={c.id} variants={ITEM_VARIANTS}>
                    <Link
                      to={`/produtos/${c.id}`}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors active:bg-pink-100',
                        isActive(`/produtos/${c.id}`) ? 'bg-pink-50 text-pink-700' : 'text-slate-800',
                      )}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-xl">{c.icon}</span>
                      <span className="flex-1 text-sm font-semibold">{c.label}</span>
                      <span className="text-xs text-slate-400">{counts[c.id]}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>

              <div className="mx-5 my-4 h-px bg-pink-100" />

              <motion.ul
                className="px-3"
                variants={LIST_VARIANTS}
                initial={reduce ? false : 'hidden'}
                animate="show"
                custom={0.05 + categories.length * 0.03}
              >
                {links.map((l) => (
                  <motion.li key={l.href} variants={ITEM_VARIANTS}>
                    <Link
                      to={l.href}
                      onClick={onClose}
                      className={cn(
                        'block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors active:bg-pink-100',
                        isActive(l.href) ? 'bg-pink-50 font-bold text-pink-700' : 'text-slate-600',
                      )}
                    >
                      {l.label}
                    </Link>
                  </motion.li>
                ))}
                {isAuthenticated && (
                  <motion.li variants={ITEM_VARIANTS}>
                    <Link to="/favoritos" onClick={onClose} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600">
                      <Heart className="h-4 w-4" aria-hidden /> {t('nav.favorites')}
                    </Link>
                  </motion.li>
                )}
                {isAdmin && (
                  <motion.li variants={ITEM_VARIANTS}>
                    <Link to="/admin" onClick={onClose} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-pink-600">
                      {t('nav.admin')}
                    </Link>
                  </motion.li>
                )}
              </motion.ul>

              <div className="flex flex-col items-start gap-2 px-5 py-5">
                <CountrySwitcher />
                <LanguageSwitcher />
              </div>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default MobileMenuDrawer;
