import React from 'react';
import { Link } from 'react-router-dom';
import { Tag, ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/products/ProductCard';
import { useProducts } from '@/context/ProductsContext';
import { hasDiscount } from '@/utils/pricing';
import { Button } from '@/components/ui/button';

const Offers: React.FC = () => {
  const { products } = useProducts();
  const offers = products.filter((p) => !p.hidden && hasDiscount(p));

  return (
    <Layout>
      <div className="gradient-hero py-10">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <span className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-extrabold px-3 py-1 rounded-full mb-3">
            <Tag className="w-3.5 h-3.5" /> PROMOÇÕES
          </span>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-2">Ofertas</h1>
          <p className="text-muted-foreground">Produtos com desconto, direto do Japão. Aproveite enquanto durar! 🔥</p>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          {offers.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {offers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                <Tag className="w-7 h-7 text-muted-foreground" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">Nenhuma oferta no momento</h2>
              <p className="text-muted-foreground mb-5">Fique de olho — em breve teremos promoções! Enquanto isso, confira o catálogo completo.</p>
              <Button asChild className="btn-primary gap-2">
                <Link to="/produtos">Ver todos os produtos <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Offers;
