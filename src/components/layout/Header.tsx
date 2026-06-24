import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, ChevronDown, UserCircle, Heart, Lock, Package, ShieldCheck as ShieldCheckIcon, Plane } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import CountrySwitcher from '@/components/CountrySwitcher';
import JapanExpressLogo from '@/components/JapanExpressLogo';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated, user, isAdmin } = useUser();
  const { t, selectedCountry } = useLanguage();
  const location = useLocation();
  const { settings } = useSiteSettings();

  const navItems = [
    { 
      label: t('nav.products'), 
      href: '/produtos',
      submenu: [
        { label: t('nav.products.cosmeticos'), href: '/produtos/cosmeticos' },
        { label: t('nav.products.doces'), href: '/produtos/doces' },
      ]
    },
    { label: t('nav.offers'), href: '/ofertas' },
    ...(settings.vlogEnabled ? [{ label: t('nav.vlog'), href: '/vlog' }] : []),
    { label: t('nav.shipping'), href: '/frete' },
    { label: t('nav.howItWorks'), href: '/como-funciona' },
    { label: t('nav.customRequest'), href: '/faca-seu-pedido' },
    { label: t('nav.business'), href: '/empresas' },
    { label: t('nav.about'), href: '/sobre' },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  // No painel admin a loja é só em português → esconde o seletor de idioma
  const isAdminPage = location.pathname.startsWith('/admin');

  const trustItems = [
    { icon: Lock,            text: 'SSL Seguro' },
    { icon: ShieldCheckIcon, text: 'Compra Protegida' },
    { icon: Package,         text: 'Remessa Conforme' },
    { icon: Plane,           text: 'Envio direto do Japão 🇯🇵' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      {/* Barra de confiança — esconde no painel admin */}
      {!isAdminPage && (
        <div className="bg-primary text-primary-foreground text-[11px] font-semibold overflow-hidden">
          <div className="flex items-center justify-center gap-0 animate-none">
            <div className="flex items-center gap-6 px-4 py-1.5 overflow-x-auto scrollbar-none whitespace-nowrap w-full justify-center">
              {trustItems.map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5 shrink-0">
                  <Icon className="w-3 h-3 opacity-90" />
                  {text}
                  <span className="text-primary-foreground/40 mx-1 hidden sm:inline">|</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1.5 group shrink-0">
            <JapanExpressLogo size={44} className="w-9 h-9 sm:w-11 sm:h-11 animate-float drop-shadow-lg group-hover:scale-105 transition-transform shrink-0" />
            <div className="flex items-baseline gap-1">
              <span className="font-display text-lg sm:text-xl lg:text-2xl font-black text-foreground tracking-tight">Japan</span>
              <span className="font-display text-sm sm:text-base lg:text-xl font-extrabold text-white bg-gradient-to-r from-primary to-accent shadow-md px-1.5 py-0.5 rounded-lg transform -rotate-6">Express</span>
            </div>
          </Link>

          {/* Desktop Navigation (escondida no painel admin) */}
          <nav className={cn("items-center gap-1", isAdminPage ? "hidden" : "hidden xl:flex")}>
            {navItems.map((item, index) => (
              <div key={item.label} className="relative group flex items-center">
                {index > 0 && (
                  <span className="w-px h-4 bg-border/60 mr-1 shrink-0" />
                )}
                {item.submenu ? (
                  <button
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium transition-all px-3 py-1.5 rounded-full whitespace-nowrap",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                    )}
                    onMouseEnter={() => setIsProductsOpen(true)}
                    onMouseLeave={() => setIsProductsOpen(false)}
                  >
                    {item.label}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    className={cn(
                      "text-sm font-medium transition-all px-3 py-1.5 rounded-full whitespace-nowrap",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                    )}
                  >
                    {item.label}
                  </Link>
                )}

                {/* Dropdown */}
                {item.submenu && (
                  <div 
                    className={cn(
                      "absolute top-full left-0 pt-2 transition-all duration-200",
                      isProductsOpen ? "opacity-100 visible" : "opacity-0 invisible"
                    )}
                    onMouseEnter={() => setIsProductsOpen(true)}
                    onMouseLeave={() => setIsProductsOpen(false)}
                  >
                    <div className="bg-card rounded-lg shadow-card border border-border py-2 min-w-[180px]">
                      <Link
                        to={item.href}
                        className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                      >
                        {t('nav.products.all')}
                      </Link>
                      {item.submenu.map((sub) => (
                        <Link
                          key={sub.href}
                          to={sub.href}
                          className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Cart, Language & Mobile Menu */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* País + Idioma — linha única lado a lado */}
            {!isAdminPage && (
              <div className="flex items-center gap-1">
                <div className="hidden md:block">
                  <CountrySwitcher />
                </div>
                <LanguageSwitcher />
              </div>
            )}

            {/* Admin + Perfil lado a lado (desktop) */}
            <div className="hidden xl:flex flex-row items-center gap-1">
              {isAdmin && (
                <Link
                  to={isAdminPage ? '/' : '/admin'}
                  className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 border border-orange-300/60 rounded-full text-[11px] font-semibold text-orange-700 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
                >
                  {isAdminPage
                    ? <><ShoppingCart className="w-3.5 h-3.5" /> Ver Loja</>
                    : <><UserCircle className="w-3.5 h-3.5 animate-pulse" /> Admin</>}
                </Link>
              )}
              <Link
                to={isAuthenticated ? '/perfil' : '/cadastro'}
                className="flex items-center gap-1.5 px-2 py-1 bg-secondary/80 border border-border rounded-full text-[11px] font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                <UserCircle className="w-3.5 h-3.5" />
                {isAuthenticated ? (user?.name?.split(' ')[0] || t('nav.profile')) : t('nav.register')}
              </Link>
            </div>

            {/* Wishlist Button (escondido no admin) */}
            {isAuthenticated && !isAdminPage && (
              <Link
                to="/favoritos"
                className="relative p-2 rounded-full hover:bg-secondary/50 transition-colors hidden xl:block"
                title={t('nav.favorites')}
              >
                <Heart className="w-6 h-6 text-foreground" />
              </Link>
            )}

            {/* Carrinho (escondido no admin) */}
            {!isAdminPage && (
              <Link
                to="/carrinho"
                className="relative p-2 rounded-full hover:bg-secondary/50 transition-colors"
              >
                <ShoppingCart className="w-6 h-6 text-foreground" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Link>
            )}

            <button
              className="xl:hidden p-2 rounded-full hover:bg-secondary/50 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="xl:hidden py-4 border-t border-border animate-fade-up">
            {/* Switchers (escondidos no admin) */}
            {!isAdminPage && (
              <div className="flex flex-col items-center gap-3 pb-4 mb-4 border-b border-border">
                <CountrySwitcher />
                <LanguageSwitcher />
              </div>
            )}

            {!isAdminPage && navItems.map((item) => (
              <div key={item.label}>
                <Link
                  to={item.href}
                  className={cn(
                    "block py-3 text-base font-medium transition-colors",
                    isActive(item.href) ? "text-primary" : "text-muted-foreground"
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
                {item.submenu && (
                  <div className="pl-4">
                    {item.submenu.map((sub) => (
                      <Link
                        key={sub.href}
                        to={sub.href}
                        className="block py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button 
              asChild
              variant="ghost" 
              className="w-full justify-start mt-2 text-base font-medium"
            >
              <Link to={isAuthenticated ? "/perfil" : "/cadastro"} onClick={() => setIsMenuOpen(false)}>
                <UserCircle className="w-5 h-5 mr-2" />
                {isAuthenticated ? (user?.name?.split(' ')[0] || t('nav.profile')) : t('nav.register')}
              </Link>
            </Button>
            {/* Wishlist Mobile (escondido no admin) */}
            {isAuthenticated && !isAdminPage && (
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start text-base font-medium"
              >
                <Link to="/favoritos" onClick={() => setIsMenuOpen(false)}>
                  <Heart className="w-5 h-5 mr-2" />
                  {t('nav.favorites')}
                </Link>
              </Button>
            )}
            {/* Admin/Loja Mobile */}
            {isAdmin && (
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start text-base font-medium text-orange-600 hover:text-orange-700"
              >
                {isAdminPage ? (
                  <Link to="/" onClick={() => setIsMenuOpen(false)}>
                    <ShoppingCart className="w-5 h-5 mr-2 text-primary" />
                    Ver Loja
                  </Link>
                ) : (
                  <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                    <UserCircle className="w-5 h-5 mr-2 text-primary animate-pulse" />
                    {t('nav.admin')}
                  </Link>
                )}
              </Button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
