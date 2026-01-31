import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, ChevronDown, UserCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated, user } = useUser();
  const location = useLocation();

  const navItems = [
    { 
      label: 'Produtos', 
      href: '/produtos',
      submenu: [
        { label: 'Artesanal', href: '/produtos/artesanal' },
        { label: 'Premium', href: '/produtos/premium' }
      ]
    },
    { label: 'Vlog', href: '/vlog' },
    { label: 'Frete', href: '/frete' },
    { label: 'Quem Somos', href: '/sobre' },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img 
              src="/logo/sabor-do-campo.png" 
              alt="Sabor do Campo" 
              className="h-16 w-auto object-contain"
            />
            <span className="font-display text-xl font-semibold text-foreground hidden sm:block">
              Sabor do Campo
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <div key={item.label} className="relative group">
                {item.submenu ? (
                  <button
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium transition-colors py-2",
                      isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                      "text-sm font-medium transition-colors py-2",
                      isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                        Todos os Produtos
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

          {/* Cart & Mobile Menu */}
          <div className="flex items-center gap-4">
            <Button 
              asChild
              variant="ghost" 
              size="sm"
              className="hidden lg:flex items-center gap-2"
            >
              <Link to={isAuthenticated ? "/perfil" : "/cadastro"}>
                <UserCircle className="w-5 h-5" />
                <span>{isAuthenticated ? (user?.name?.split(' ')[0] || 'Perfil') : 'Cadastro'}</span>
              </Link>
            </Button>

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

            <button
              className="lg:hidden p-2 rounded-full hover:bg-secondary/50 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-border animate-fade-up">
            {navItems.map((item) => (
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
                {isAuthenticated ? (user?.name?.split(' ')[0] || 'Perfil') : 'Cadastro'}
              </Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
