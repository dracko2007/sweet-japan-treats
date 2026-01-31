import React from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/products/ProductCard';
import { products, getProductsByCategory } from '@/data/products';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const Products: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  
  const displayProducts = category && (category === 'artesanal' || category === 'premium')
    ? getProductsByCategory(category)
    : products;

  const categories = [
    { id: 'all', label: 'Todos', href: '/produtos' },
    { id: 'artesanal', label: 'Artesanal', href: '/produtos/artesanal' },
    { id: 'premium', label: 'Premium', href: '/produtos/premium' },
  ];

  const currentCategory = category || 'all';

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Nossos Produtos
            </h1>
            <p className="text-muted-foreground text-lg">
              Descubra nossa linha completa de doces de leite artesanais, 
              feitos com ingredientes selecionados e muito carinho.
            </p>
          </div>

          {/* Category Filters */}
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
          {/* Category Info */}
          {category && (
            <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl",
                  category === 'premium' ? "bg-gold/20" : "bg-primary/10"
                )}>
                  {category === 'premium' ? '⭐' : '🍯'}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {category === 'premium' ? 'Linha Premium' : 'Linha Artesanal'}
                  </h2>
                  <p className="text-muted-foreground">
                    {category === 'premium' 
                      ? 'Sabores exclusivos com ingredientes especiais. 280g: ¥1.400 | 800g: ¥2.400'
                      : 'Sabores tradicionais que você conhece e ama. 280g: ¥1.200 | 800g: ¥2.000'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {displayProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Products;
