import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Share2, Star } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import ProductGallery from '@/components/products/ProductGallery';
import ProductReviews from '@/components/products/ProductReviews';
import { products } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { wishlistService } from '@/services/wishlistService';
import { reviewService } from '@/services/reviewService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();

  const product = products.find(p => p.id === id);
  const [selectedSize, setSelectedSize] = useState<'small' | 'large'>('small');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(
    user?.email ? wishlistService.isInWishlist(user.email, id || '') : false
  );

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
          <Button onClick={() => navigate('/produtos')}>Voltar aos Produtos</Button>
        </div>
      </Layout>
    );
  }

  const currentPrice = selectedSize === 'small' ? product.prices.small : product.prices.large;
  const productRating = reviewService.getProductRating(product.id);
  const images = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];

  const handleAddToCart = () => {
    addToCart(product, selectedSize, quantity);
    toast({
      title: "Adicionado ao carrinho!",
      description: `${product.name} (${selectedSize === 'small' ? '280g' : '800g'}) x${quantity}`,
    });
  };

  const handleToggleFavorite = () => {
    if (!user?.email) {
      toast({
        title: "Login necessário",
        description: "Faça login para adicionar aos favoritos",
        variant: "destructive",
      });
      return;
    }

    if (isFavorite) {
      wishlistService.removeFromWishlist(user.email, product.id);
      setIsFavorite(false);
      toast({
        title: "Removido dos favoritos",
        description: `${product.name} removido da lista de desejos`,
      });
    } else {
      wishlistService.addToWishlist(user.email, {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productPrice: product.prices.small,
      });
      setIsFavorite(true);
      toast({
        title: "Adicionado aos favoritos! ❤️",
        description: `${product.name} salvo na sua lista de desejos`,
      });
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    const text = `Confira ${product.name} - Doce de Leite Artesanal 🍯`;

    if (navigator.share) {
      navigator.share({ title: product.name, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para sua área de transferência",
      });
    }
  };

  return (
    <Layout>
      <div className="gradient-hero py-8">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/produtos')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar aos Produtos
          </Button>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Gallery */}
              <div>
                <ProductGallery 
                  images={images} 
                  productName={product.name}
                  video={product.video}
                />
              </div>

              {/* Product Info */}
              <div>
                <div className="mb-4">
                  <span className={cn(
                    "inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase",
                    product.category === 'premium'
                      ? 'bg-gold/20 text-gold'
                      : 'bg-primary/20 text-primary'
                  )}>
                    {product.category === 'premium' ? '★ Premium' : 'Artesanal'}
                  </span>
                </div>

                <h1 className="font-display text-4xl font-bold mb-4">{product.name}</h1>
                
                {/* Rating */}
                {productRating.totalReviews > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-5 h-5",
                            i < Math.floor(productRating.averageRating)
                              ? "text-yellow-500 fill-yellow-500"
                              : "text-gray-300"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {productRating.averageRating.toFixed(1)} ({productRating.totalReviews} avaliações)
                    </span>
                  </div>
                )}

                <p className="text-lg text-muted-foreground mb-6">{product.description}</p>

                <div className="bg-secondary/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Sabor</p>
                  <p className="font-semibold">{product.flavor}</p>
                </div>

                {/* Size Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">Tamanho</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedSize('small')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-left",
                        selectedSize === 'small'
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="font-semibold mb-1">280g - Pequeno</div>
                      <div className="text-2xl font-bold text-primary">
                        ¥{product.prices.small.toLocaleString()}
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedSize('large')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-left",
                        selectedSize === 'large'
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="font-semibold mb-1">800g - Grande</div>
                      <div className="text-2xl font-bold text-primary">
                        ¥{product.prices.large.toLocaleString()}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">Quantidade</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border-2 border-border rounded-xl">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="px-4 py-3 hover:bg-secondary transition-colors"
                      >
                        -
                      </button>
                      <span className="px-6 font-semibold">{quantity}</span>
                      <button
                        onClick={() => setQuantity(q => q + 1)}
                        className="px-4 py-3 hover:bg-secondary transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      ¥{(currentPrice * quantity).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mb-6">
                  <Button
                    onClick={handleAddToCart}
                    size="lg"
                    className="flex-1 gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Adicionar ao Carrinho
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleToggleFavorite}
                    className={cn(isFavorite && "bg-red-50 dark:bg-red-950 border-red-500")}
                  >
                    <Heart className={cn("w-5 h-5", isFavorite && "fill-red-500 text-red-500")} />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleShare}
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Info */}
                <div className="border-t border-border pt-6 space-y-3 text-sm text-muted-foreground">
                  <p>✓ Produto artesanal feito com ingredientes naturais</p>
                  <p>✓ Entrega em todo o Japão via correios</p>
                  <p>✓ Embalagem especial para presente</p>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="mt-16">
              <ProductReviews productId={product.id} productName={product.name} />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ProductDetail;
