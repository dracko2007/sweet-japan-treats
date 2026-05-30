import React from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/products/ProductCard';
import { products, getProductsByCategory } from '@/data/products';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

const Products: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  const { t, selectedCountry } = useLanguage();
  
  const displayProducts = (category && category !== 'all'
    ? getProductsByCategory(category)
    : products
  ).filter(p => {
    if (selectedCountry === 'Japão') {
      return p.deliveryRestrict === 'Japão';
    } else {
      return p.deliveryRestrict !== 'Japão';
    }
  });

  const categories = [
    { id: 'all', label: t('productsPage.all') || 'Todos', href: '/produtos' },
    { id: 'cosmeticos', label: t('nav.products.cosmeticos'), href: '/produtos/cosmeticos', restrict: 'Brasil' },
    { id: 'acessorios', label: t('nav.products.acessorios'), href: '/produtos/acessorios', restrict: 'Brasil' },
    { id: 'doces', label: t('nav.products.doces'), href: '/produtos/doces', restrict: 'Brasil' },
    { id: 'papelaria', label: t('nav.products.papelaria'), href: '/produtos/papelaria', restrict: 'Brasil' },
    { id: 'doce-de-leite', label: t('nav.products.docedeleite'), href: '/produtos/doce-de-leite', restrict: 'Japão' },
  ].filter(cat => {
    if (cat.restrict === 'Japão') return selectedCountry === 'Japão';
    if (cat.restrict === 'Brasil') return selectedCountry === 'Brasil';
    return true;
  });

  const currentCategory = category || 'all';

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {t('productsPage.title')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('productsPage.description')}
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-8">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={cat.href}
                className={cn(
                  "px-6 py-2.5 rounded-full font-medium text-sm transition-all",
                  currentCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {category && category !== 'all' && (
            <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-primary/10"
                )}>
                  {category === 'cosmeticos' ? '🧴' : 
                   category === 'acessorios' ? '🎮' : 
                   category === 'doces' ? '🍵' : 
                   category === 'papelaria' ? '✏️' : 
                   category === 'doce-de-leite' ? '🍯' : '🌸'}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {category === 'doce-de-leite' ? t('nav.products.docedeleite') : 
                     category === 'cosmeticos' ? t('nav.products.cosmeticos') : 
                     category === 'acessorios' ? t('nav.products.acessorios') : 
                     category === 'doces' ? t('nav.products.doces') : 
                     category === 'papelaria' ? t('nav.products.papelaria') : category}
                  </h2>
                  <p className="text-muted-foreground">
                    {category === 'doce-de-leite' ? 'O legítimo doce de leite cremoso brasileiro, disponível apenas para envio rápido no Japão com frete grátis!' : 
                     category === 'cosmeticos' ? 'Os cosméticos, protetores solares e produtos de skin care mais famosos e tecnológicos do Japão.' : 
                     category === 'acessorios' ? 'Action figures originais de anime, luminárias kawaii e organizadores de design minimalista.' : 
                     category === 'doces' ? 'Doces finos de matcha, chás verdes tradicionais orgânicos e guloseimas exclusivas de Tóquio.' : 
                     category === 'papelaria' ? 'Canetas gel Sakura de fluxo suave e papelaria japonesa de alta durabilidade e estilo.' : 
                     'Confira nossa seleção exclusiva direto de Tóquio.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {displayProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t('productsPage.noProducts')}</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Products;
