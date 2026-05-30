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
import { useLanguage } from '@/context/LanguageContext';
import { getTranslatedProductName, getTranslatedProductDesc, getTranslatedProductFlavor } from '@/data/translations';
import { formatPrice } from '@/utils/currency';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, selectedCountry } = useLanguage();

  const product = products.find(p => p.id === id);
  const [selectedSize, setSelectedSize] = useState<'small' | 'large'>('small');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(
    user?.email ? wishlistService.isInWishlist(user.email, id || '') : false
  );

  if (!product || (product.deliveryRestrict === 'Japão' && selectedCountry !== 'Japão')) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('productDetail.notFound')}</h1>
          <Button onClick={() => navigate('/produtos')}>{t('productDetail.back')}</Button>
        </div>
      </Layout>
    );
  }

  const translatedName = getTranslatedProductName(product.id, t);
  const translatedDesc = getTranslatedProductDesc(product.id, t);
  const translatedFlavor = getTranslatedProductFlavor(product.id, t);

  const currency = product.deliveryRestrict === 'Japão' ? 'JPY' : (selectedCountry === 'Japão' ? 'JPY' : 'BRL');
  
  const getDisplayPrice = (size: 'small' | 'large') => {
    const basePrice = size === 'small' ? product.prices.small : product.prices.large;
    if (product.deliveryRestrict === 'Japão') return basePrice;
    if (selectedCountry === 'Japão') return basePrice * 28;
    return basePrice;
  };

  const currentPrice = getDisplayPrice(selectedSize);
  const productRating = reviewService.getProductRating(product.id);
  const images = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];

  const handleAddToCart = () => {
    addToCart(product, selectedSize, quantity);
    toast({
      title: t('productDetail.added'),
      description: `${translatedName} (${selectedSize === 'small' ? 'Padrão' : 'Deluxe'}) x${quantity}`,
    });
  };

  const handleToggleFavorite = () => {
    if (!user?.email) {
      toast({
        title: t('productDetail.loginRequired'),
        description: t('productDetail.loginFavorite'),
        variant: "destructive",
      });
      return;
    }

    if (isFavorite) {
      wishlistService.removeFromWishlist(user.email, product.id);
      setIsFavorite(false);
      toast({
        title: t('productDetail.removedFavorite'),
        description: `${translatedName}`,
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
        title: t('productDetail.addedFavorite'),
        description: translatedName,
      });
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    const text = `${translatedName} 🍯`;

    if (navigator.share) {
      navigator.share({ title: translatedName, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: t('productDetail.linkCopied'),
        description: t('productDetail.linkCopiedDesc'),
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
            {t('productDetail.back')}
          </Button>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <ProductGallery 
                  images={images} 
                  productName={translatedName}
                  video={product.video}
                />
              </div>

              <div>
                <div className="mb-4">
                  <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-primary/20 text-primary">
                    {product.category === 'doce-de-leite' ? 'Doce de Leite 🍯' : 
                     product.category === 'cosmeticos' ? 'Cosméticos 🧴' : 
                     product.category === 'acessorios' ? 'Acessórios & Geek 🎮' : 
                     product.category === 'doces' ? 'Doces & Chás 🍵' : 
                     product.category === 'papelaria' ? 'Papelaria ✏️' : 'Importado 🌸'}
                  </span>
                </div>

                <h1 className="font-display text-4xl font-bold mb-4">{translatedName}</h1>
                
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
                      {productRating.averageRating.toFixed(1)} ({productRating.totalReviews} {t('productDetail.reviews')})
                    </span>
                  </div>
                )}

                <p className="text-lg text-muted-foreground mb-6">{translatedDesc}</p>

                <div className="bg-secondary/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-1">{t('productDetail.flavor')}</p>
                  <p className="font-semibold">{translatedFlavor}</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">{t('productDetail.size')}</label>
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
                      <div className="font-semibold mb-1">Padrão</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatPrice(getDisplayPrice('small'), currency)}
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
                      <div className="font-semibold mb-1">Deluxe</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatPrice(getDisplayPrice('large'), currency)}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">{t('productDetail.quantity')}</label>
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
                      {formatPrice(currentPrice * quantity, currency)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mb-6">
                  <Button
                    onClick={handleAddToCart}
                    size="lg"
                    className="flex-1 gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {t('productDetail.addToCart')}
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

                <div className="border-t border-border pt-6 space-y-3 text-sm text-muted-foreground">
                  <p>{t('productDetail.info1')}</p>
                  <p>{t('productDetail.info2')}</p>
                  <p>{t('productDetail.info3')}</p>
                </div>
              </div>
            </div>

            <div className="mt-16">
              <ProductReviews productId={product.id} productName={translatedName} />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ProductDetail;
