import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { products } from '@/data/products';

const FeaturedProducts: React.FC = () => {
  const featuredProducts = products.slice(0, 4);

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-up">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Nossos Produtos
          </span>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Descubra nossos sabores
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Cada pote é preparado com carinho, seguindo receitas tradicionais 
            brasileiras adaptadas com ingredientes locais japoneses de alta qualidade.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {featuredProducts.map((product, index) => (
            <Link
              key={product.id}
              to={`/produtos/${product.category}`}
              className="group card-product"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Image */}
              <div className="aspect-square bg-secondary/50 relative overflow-hidden">
                {product.video ? (
                  <video 
                    src={product.video} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    poster={product.image}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Erro ao carregar vídeo:', product.video);
                      const videoElement = e.target as HTMLVideoElement;
                      videoElement.style.display = 'none';
                    }}
                  />
                ) : product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-caramel-light/40 to-primary/30 flex items-center justify-center">
                    <span className="text-6xl opacity-80">🍯</span>
                  </div>
                )}
                
                {/* Category Badge */}
                <div className="absolute top-3 left-3">
                  <span className={`
                    px-3 py-1 rounded-full text-xs font-medium
                    ${product.category === 'premium' 
                      ? 'bg-gold/20 text-caramel-dark' 
                      : 'bg-primary/20 text-primary'
                    }
                  `}>
                    {product.category === 'premium' ? '★ Premium' : 'Artesanal'}
                  </span>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {product.description}
                </p>
                
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">A partir de</p>
                    <p className="font-display text-xl font-bold text-primary">
                      ¥{product.prices.small.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-gold">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-sm font-medium">5.0</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="btn-primary rounded-full px-8">
            <Link to="/produtos">
              Ver todos os produtos
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
