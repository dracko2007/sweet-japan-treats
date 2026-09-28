import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Home, LayoutGrid, Search, ShoppingBag, UserCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { CART_KICK } from './flyToCart';

interface Props {
  cartCount: number;
  /** Incrementa quando um produto pousa no carrinho — dispara o balanço do ícone. */
  cartKick: number;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  onOpenCart: () => void;
}

/**
 * Barra inferior estilo app (Shein/Temu/Shopee): alvos grandes ao alcance do
 * polegar. A altura é exposta em `--bottom-nav-h` (index.css) para os botões
 * flutuantes subirem junto.
 */
const MobileBottomNav: React.FC<Props> = ({ cartCount, cartKick, onOpenMenu, onOpenSearch, onOpenCart }) => {
  const { t } = useLanguage();
  const { isAuthenticated } = useUser();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const accountHref = isAuthenticated ? '/perfil' : '/cadastro';

  const tabs = [
    { key: 'home', label: t('navPro.home'), icon: Home, to: '/', active: pathname === '/' },
    { key: 'cats', label: t('navPro.categories'), icon: LayoutGrid, onClick: onOpenMenu, active: pathname.startsWith('/produtos') },
    { key: 'search', label: t('navPro.search'), icon: Search, onClick: onOpenSearch, active: false },
    { key: 'cart', label: t('nav.cart'), icon: ShoppingBag, onClick: onOpenCart, active: pathname === '/carrinho', badge: cartCount },
    { key: 'account', label: t('navPro.account'), icon: UserCircle, to: accountHref, active: pathname === accountHref },
  ];

  return (
    <nav
      aria-label={t('navPro.menu')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-pink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-20px_rgba(157,23,77,0.4)] backdrop-blur-xl md:hidden print:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map(({ key, label, icon: Icon, to, onClick, active, badge }) => {
          const body = (
            <>
              {active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-3 top-1.5 h-8 rounded-full bg-pink-100"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
                  aria-hidden
                />
              )}
              <motion.span
                key={key === 'cart' ? cartKick : undefined}
                className="relative block"
                whileTap={reduce ? undefined : { scale: 0.8 }}
                animate={key === 'cart' && cartKick && !reduce ? CART_KICK : undefined}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <Icon className={cn('h-5 w-5 transition-transform', active ? 'scale-110 text-pink-600' : 'text-slate-500')} aria-hidden />
                {!!badge && (
                  <motion.span
                    key={badge}
                    initial={reduce ? false : { scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 14 }}
                    className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-600 px-1 text-[10px] font-bold text-white"
                  >
                    {badge}
                  </motion.span>
                )}
              </motion.span>
              <span className={cn('relative text-[10px] font-semibold', active ? 'text-pink-700' : 'text-slate-500')}>{label}</span>
            </>
          );
          const cls = 'relative flex h-full w-full flex-col items-center justify-center gap-1 pt-1 active:scale-95 transition-transform';
          return (
            <li key={key}>
              {to ? (
                <Link to={to} className={cls} aria-current={active ? 'page' : undefined}>{body}</Link>
              ) : (
                <button type="button" onClick={onClick} className={cls} data-cart-target={key === 'cart' ? 'bottom' : undefined}>{body}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
