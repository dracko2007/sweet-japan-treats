import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { ChevronDown, Heart, Lock, Package, Plane, Search, ShieldCheck, ShoppingBag, UserCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { useProducts } from '@/context/ProductsContext';
import { categoryService, DEFAULT_CATEGORIES, type ProductCategory } from '@/services/categoryService';
import { raffleService } from '@/services/raffleService';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import CountrySwitcher from '@/components/CountrySwitcher';
import JapanExpressLogo from '@/components/JapanExpressLogo';
import { cn } from '@/lib/utils';
import MegaMenu from './pro/MegaMenu';
import SearchPalette from './pro/SearchPalette';
import MiniCartDrawer from './pro/MiniCartDrawer';
import MobileMenuDrawer from './pro/MobileMenuDrawer';
import MobileBottomNav from './pro/MobileBottomNav';
import { CART_KICK, findCartTarget, findSourceImage, flyToCart, trackPointer } from './pro/flyToCart';

const MEGA_ID = 'header-pro-mega-menu';
const HOVER_OPEN_MS = 80;
const HOVER_CLOSE_MS = 160;

/**
 * SANDBOX — header de navegação "pro". Mantém as mesmas alturas do Header
 * original no topo da página (o <main> do Layout continua com o mesmo padding).
 */
const HeaderPro: React.FC = () => {
  const { t } = useLanguage();
  const { items, totalItems } = useCart();
  const { isAuthenticated, user, isAdmin } = useUser();
  const { products } = useProducts();
  const { settings } = useSiteSettings();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();

  const [allCategories, setAllCategories] = useState<ProductCategory[]>(DEFAULT_CATEGORIES);
  useEffect(() => {
    categoryService.getAll().then(setAllCategories).catch(() => {});
  }, []);

  // Mesmo critério do Header original: link do sorteio só com sorteio publicado.
  const [raffleLive, setRaffleLive] = useState(false);
  useEffect(() => {
    raffleService.getRaffle().then((r) => setRaffleLive(r.published === true)).catch(() => {});
  }, []);

  const counts = useMemo(
    () =>
      products.reduce<Record<string, number>>((acc, p) => {
        if (!p.hidden) acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {}),
    [products],
  );
  const categories = allCategories.filter((c) => counts[c.id] > 0);

  const highlights = useMemo(() => {
    const visible = products.filter((p) => !p.hidden && (p.thumbnail || p.image));
    const featured = visible.filter((p) => p.featured);
    const pool = featured.length >= 3 ? featured : [...visible].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    return pool.slice(0, 3);
  }, [products]);

  const popularTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of products) {
      if (p.hidden) continue;
      for (const tag of p.tags || []) {
        const key = tag.trim().toLowerCase();
        if (key) freq.set(key, (freq.get(key) || 0) + 1);
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag]) => tag);
  }, [products]);

  const links = [
    { label: t('nav.offers'), href: '/ofertas' },
    ...(raffleLive ? [{ label: t('nav.raffle'), href: '/sorteio' }] : []),
    ...(settings.vlogEnabled ? [{ label: t('nav.vlog'), href: '/vlog' }] : []),
    { label: t('nav.shipping'), href: '/frete' },
    { label: t('nav.howItWorks'), href: '/como-funciona' },
    { label: t('nav.customRequest'), href: '/faca-seu-pedido' },
    { label: t('nav.business'), href: '/empresas' },
    { label: t('nav.about'), href: '/sobre' },
  ];
  const isActive = useCallback((href: string) => pathname === href || pathname.startsWith(href + '/'), [pathname]);

  // ── Scroll: compacta o header e esconde a linha de navegação ao descer ──
  // Exceção: páginas com seção fixada pelo GSAP (hero do home). O pin mede a
  // altura do header uma vez (`top ${header.offsetHeight}px`); se o header
  // encolher, o hero fixado fica descolado dele. Ali a altura fica estável.
  const [compact, setCompact] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const pinnedPage = document.querySelector('.pin-spacer') !== null;
        setCompact(!pinnedPage && y > 40);
        if (pinnedPage || y < 120 || y < lastY - 4) setNavHidden(false);
        else if (y > lastY + 4) setNavHidden(true);
        lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  // ── Overlays ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // ⌘K / Ctrl+K em qualquer lugar; "/" fora de campos de texto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Ao adicionar (itens pagos sobem): a foto do produto voa até o ícone do
  // carrinho, o ícone balança e só então o mini-carrinho abre. Sem foto de
  // origem na tela (ex.: adição pelo assistente) ou com movimento reduzido,
  // abre direto. Brindes ficam de fora: são derivados e mudam quando o
  // catálogo carrega.
  useEffect(trackPointer, []);
  const [cartKick, setCartKick] = useState(0);
  const paidQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (!i.freeGift) m.set(i.product.id, (m.get(i.product.id) || 0) + i.quantity);
    return m;
  }, [items]);
  const prevPaidQty = useRef(paidQty);
  useEffect(() => {
    const prev = prevPaidQty.current;
    prevPaidQty.current = paidQty;
    const added = items.find((i) => !i.freeGift && (paidQty.get(i.product.id) || 0) > (prev.get(i.product.id) || 0));
    if (!added || pathname === '/carrinho' || pathname === '/checkout') return;

    const img = reduce ? null : findSourceImage([added.product.thumbnail || '', added.product.image || '']);
    const target = img && findCartTarget();
    if (!img || !target) {
      setCartKick((k) => k + 1);
      setCartOpen(true);
      return;
    }
    let cancelled = false;
    flyToCart(img, target).then(() => {
      if (cancelled) return;
      setCartKick((k) => k + 1);
      setCartOpen(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara só quando as quantidades mudam
  }, [paidQty]);

  // ── Mega-menu com "hover intent" ──
  const [megaOpen, setMegaOpen] = useState(false);
  const hoverTimer = useRef<number>();
  const scheduleMega = (open: boolean) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setMegaOpen(open), open ? HOVER_OPEN_MS : HOVER_CLOSE_MS);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMegaOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [megaOpen]);

  // Pill da navegação: segue o mouse; ao sair, volta para a rota ativa.
  const [hoverHref, setHoverHref] = useState<string | null>(null);
  const productsActive = pathname.startsWith('/produto');
  const pillHref = hoverHref ?? (productsActive ? '/produtos' : links.find((l) => isActive(l.href))?.href ?? null);

  const trustItems = [
    { icon: Lock, text: t('trust.ssl') },
    { icon: ShieldCheck, text: t('trust.protectedPurchase') },
    { icon: Package, text: t('trust.compliantShipping') },
    { icon: Plane, text: t('trust.directShipping') },
  ];

  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 34 };
  const collapse = reduce ? { duration: 0 } : { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const };

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b bg-white/85 backdrop-blur-xl transition-[box-shadow,border-color] duration-300',
          compact ? 'border-pink-100 shadow-[0_12px_35px_-24px_rgba(157,23,77,0.55)]' : 'border-pink-100/60',
        )}
      >
        {/* Barra de confiança — recolhe ao rolar para devolver espaço à página */}
        <motion.div
          initial={false}
          animate={{ height: compact ? 0 : 'auto', opacity: compact ? 0 : 1 }}
          transition={collapse}
          className="overflow-hidden bg-gradient-to-r from-pink-600 via-primary to-fuchsia-600 text-[11px] font-semibold text-primary-foreground"
        >
          <div className="hidden items-center justify-center gap-6 whitespace-nowrap px-4 py-1.5 lg:flex">
            {trustItems.map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 opacity-90" aria-hidden />
                {text}
              </span>
            ))}
          </div>
          <div className="overflow-hidden py-1.5 lg:hidden">
            <div className="flex animate-marquee items-center gap-8 whitespace-nowrap">
              {[...trustItems, ...trustItems].map(({ icon: Icon, text }, i) => (
                <span key={i} className="flex shrink-0 items-center gap-1.5">
                  <Icon className="h-3 w-3 opacity-90" aria-hidden />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="container mx-auto px-4">
          <div className={cn('flex items-center justify-between gap-3 transition-[height] duration-300', compact ? 'h-16' : 'h-20')}>
            <Link to="/" className="group flex shrink-0 items-center gap-1.5 sm:gap-2.5" aria-label="Japan Express — início">
              <JapanExpressLogo
                size={56}
                className={cn(
                  'shrink-0 drop-shadow-lg transition-all duration-300 group-hover:-rotate-6 group-hover:scale-105',
                  compact ? 'h-10 w-10' : 'h-11 w-11 sm:h-14 sm:w-14',
                )}
              />
              <span className="flex items-baseline gap-1">
                <span className="font-brand text-xl font-black tracking-tight text-foreground sm:text-2xl lg:text-3xl">Japan</span>
                <span className="-rotate-6 rounded-lg bg-gradient-to-r from-primary to-accent px-1.5 py-0.5 font-display text-base font-extrabold text-white shadow-md transition-transform duration-300 group-hover:rotate-0 sm:px-2 sm:text-lg lg:text-2xl">
                  Express
                </span>
              </span>
            </Link>

            {/* Gatilho da busca — parece um campo, abre a paleta instantânea */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group mx-2 hidden h-11 max-w-2xl flex-1 items-center gap-3 rounded-2xl border border-pink-100 bg-white/90 px-4 text-left text-sm text-slate-400 shadow-sm transition-all hover:border-pink-300 hover:shadow-lg hover:shadow-pink-100/60 md:flex"
              aria-label={t('navPro.search')}
              aria-haspopup="dialog"
            >
              <Search className="h-4 w-4 text-pink-500 transition-transform group-hover:scale-110" aria-hidden />
              <span className="flex-1 truncate">{t('navPro.searchPlaceholder')}</span>
              <kbd className="hidden rounded-md border border-pink-100 bg-pink-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-pink-600 lg:inline">⌘K</kbd>
            </button>

            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden flex-col gap-1 md:flex">
                <CountrySwitcher />
                <LanguageSwitcher />
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-full p-2.5 transition-colors hover:bg-pink-50 md:hidden"
                aria-label={t('navPro.search')}
              >
                <Search className="h-5 w-5 text-slate-700" />
              </button>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-full border border-pink-300/60 bg-pink-500/10 px-2.5 py-1 text-[11px] font-semibold text-pink-700 hover:bg-pink-500/20 xl:flex"
                >
                  <UserCircle className="h-3.5 w-3.5" aria-hidden /> Admin
                </Link>
              )}

              <Link
                to={isAuthenticated ? '/perfil' : '/cadastro'}
                className="hidden items-center gap-2 rounded-full px-2.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-pink-50 md:flex"
              >
                <UserCircle className="h-5 w-5" aria-hidden />
                <span className="hidden xl:inline">
                  {isAuthenticated ? user?.name?.split(' ')[0] || t('nav.profile') : t('nav.register')}
                </span>
              </Link>

              {isAuthenticated && (
                <Link
                  to="/favoritos"
                  className="hidden rounded-full p-2.5 transition-colors hover:bg-pink-50 md:block"
                  aria-label={t('nav.favorites')}
                >
                  <Heart className="h-5 w-5 text-slate-700 transition-transform hover:scale-110" />
                </Link>
              )}

              <button
                type="button"
                data-cart-target="header"
                onClick={() => setCartOpen(true)}
                className="relative rounded-full p-2.5 transition-colors hover:bg-pink-50"
                aria-label={`${t('nav.cart')}${totalItems > 0 ? ` — ${totalItems}` : ''}`}
                aria-haspopup="dialog"
              >
                <motion.span
                  key={cartKick}
                  className="block"
                  animate={cartKick && !reduce ? CART_KICK : undefined}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <ShoppingBag className="h-5 w-5 text-slate-700" />
                </motion.span>
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span
                      key={totalItems}
                      initial={reduce ? false : { scale: 0.3, y: -6 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 14 }}
                      className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent px-1 text-[10px] font-bold text-white shadow-md"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          {/* Linha de navegação — some ao descer, volta ao subir */}
          <motion.div
            initial={false}
            animate={{ height: navHidden ? 0 : 'auto', opacity: navHidden ? 0 : 1 }}
            transition={collapse}
            className="hidden overflow-hidden md:block"
          >
            <nav
              aria-label="Navegação principal"
              onMouseLeave={() => setHoverHref(null)}
              className="flex items-center gap-1 overflow-x-auto border-t border-pink-100/60 py-2 scrollbar-hide"
            >
              <button
                type="button"
                aria-expanded={megaOpen}
                aria-controls={MEGA_ID}
                onClick={() => setMegaOpen((o) => !o)}
                onMouseEnter={() => {
                  setHoverHref('/produtos');
                  scheduleMega(true);
                }}
                onMouseLeave={() => scheduleMega(false)}
                className={cn(
                  'relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors',
                  pillHref === '/produtos' || megaOpen ? 'text-pink-700' : 'text-pink-600',
                )}
              >
                {(pillHref === '/produtos' || megaOpen) && (
                  <motion.span layoutId="header-pro-pill" className="absolute inset-0 rounded-full bg-pink-100" transition={spring} aria-hidden />
                )}
                <span className="relative">{t('nav.products')}</span>
                <ChevronDown
                  className={cn('relative h-3.5 w-3.5 transition-transform duration-200', megaOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>

              {links.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onMouseEnter={() => {
                    setHoverHref(item.href);
                    scheduleMega(false);
                  }}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                    isActive(item.href) ? 'text-pink-700' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {pillHref === item.href && !megaOpen && (
                    <motion.span
                      layoutId="header-pro-pill"
                      className={cn('absolute inset-0 rounded-full', isActive(item.href) ? 'bg-pink-100' : 'bg-slate-100')}
                      transition={spring}
                      aria-hidden
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              ))}
            </nav>
          </motion.div>
        </div>

        <AnimatePresence>
          {megaOpen && (
            <MegaMenu
              id={MEGA_ID}
              categories={categories}
              counts={counts}
              tags={popularTags}
              highlights={highlights}
              onNavigate={() => setMegaOpen(false)}
              onMouseEnter={() => scheduleMega(true)}
              onMouseLeave={() => scheduleMega(false)}
            />
          )}
        </AnimatePresence>

        {/* Progresso de leitura da página */}
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-pink-500 via-primary to-fuchsia-500"
          style={{ scaleX: progress }}
          aria-hidden
        />
      </header>

      {/* Overlays fora do <header>: o backdrop-filter dele seria o containing
          block de filhos `fixed`. */}
      <SearchPalette open={searchOpen} onClose={closeSearch} categories={categories} />
      <MiniCartDrawer open={cartOpen} onClose={closeCart} />
      <MobileMenuDrawer
        open={menuOpen}
        onClose={closeMenu}
        categories={categories}
        counts={counts}
        links={links}
        isActive={isActive}
      />
      <MobileBottomNav
        cartCount={totalItems}
        cartKick={cartKick}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenCart={() => setCartOpen(true)}
      />
    </>
  );
};

export default HeaderPro;
