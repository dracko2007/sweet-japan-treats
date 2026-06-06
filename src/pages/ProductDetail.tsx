import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Heart, Share2, Star } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import ProductGallery from '@/components/products/ProductGallery';
import ProductReviews from '@/components/products/ProductReviews';
import { useProducts } from '@/context/ProductsContext';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { wishlistService } from '@/services/wishlistService';
import { reviewService } from '@/services/reviewService';
import { registrarEvento } from '@/services/eventosService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslatedProductName, getTranslatedProductDesc, getTranslatedProductFlavor } from '@/data/translations';
import { i18nName, i18nDesc } from '@/utils/productI18n';
import { formatPrice } from '@/utils/currency';
import { effectiveYen, baseYen, hasDiscount, getVariants } from '@/utils/pricing';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, language, selectedCountry } = useLanguage();
  const { products, loading: productsLoading } = useProducts();

  const product = products.find(p => p.id === id);
  const productVariants = product ? getVariants(product) : [];
  const [selectedSize, setSelectedSize] = useState<string>('small');
  const selectedVariant = productVariants.find((v) => v.id === selectedSize) || productVariants[0];
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(
    user?.email ? wishlistService.isInWishlist(user.email, id || '') : false
  );

  // Registra que o usuário abriu este produto (coleta para futuras recomendações).
  // Só dispara quando o ID do produto muda — não a cada re-render da tela.
  useEffect(() => {
    if (product) {
      registrarEvento('viu_produto', product.id, product.category);
      const vs = getVariants(product);
      if (vs.length && !vs.some((v) => v.id === selectedSize)) setSelectedSize(vs[0].id);
    }
  }, [product?.id]);

  // Enquanto os produtos carregam, evita piscar "não encontrado".
  if (!product && productsLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('common.loading') || 'Carregando...'}</p>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('productDetail.notFound')}</h1>
          <Button onClick={() => navigate('/produtos')}>{t('productDetail.back')}</Button>
        </div>
      </Layout>
    );
  }

  const translatedName = i18nName(product, language) || getTranslatedProductName(product.id, t);
  const translatedDesc = i18nDesc(product, language) || getTranslatedProductDesc(product.id, t);
  const translatedFlavor = getTranslatedProductFlavor(product.id, t);

  const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(selectedCountry);
  const currency = selectedCountry === 'Japão' ? 'JPY' : (isEuro ? 'EUR' : 'BRL');
  
  const convertYen = (yen: number) => {
    if (selectedCountry === 'Japão') return yen;
    if (isEuro) return (yen / 28) * 0.16;
    return yen / 28;
  };
  const getDisplayPrice = (size: string) => convertYen(effectiveYen(product, size));

  const currentPrice = getDisplayPrice(selectedSize);
  const promoActive = hasDiscount(product);
  const originalPrice = convertYen(baseYen(product, selectedSize));
  const productRating = reviewService.getProductRating(product.id);
  const images = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];

  const handleAddToCart = () => {
    addToCart(product, selectedSize, quantity, selectedVariant?.label);
    toast({
      title: t('productDetail.added'),
      description: `${translatedName} (${selectedVariant?.label || ''}) x${quantity}`,
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
                    {product.category === 'cosmeticos' ? 'Cosméticos 🧴' : 
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

                {/* Seletor de tamanho/variante */}
                {productVariants.length > 1 && (
                  <div className="mb-6">
                    <span className="block text-sm font-semibold text-muted-foreground mb-2">Escolha o tamanho</span>
                    <div className="flex flex-wrap gap-2">
                      {productVariants.map((v) => {
                        const active = v.id === selectedSize;
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelectedSize(v.id)}
                            className={cn(
                              'px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                              active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/50'
                            )}
                          >
                            {v.label}
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {formatPrice(convertYen(effectiveYen(product, v.id)), currency)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-6 border-b pb-4 border-border/50">
                  <span className="block text-sm font-semibold text-muted-foreground mb-1">Preço Unitário</span>
                  {promoActive ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-3xl font-black text-primary">{formatPrice(currentPrice, currency)}</span>
                      <span className="text-lg font-semibold text-gray-500 dark:text-gray-400 line-through decoration-2">
                        {formatPrice(originalPrice, currency)}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-extrabold shadow-sm">
                        -{product.discountPercent}% OFF
                      </span>
                    </div>
                  ) : (
                    <div className="text-3xl font-black text-primary">
                      {formatPrice(currentPrice, currency)}
                    </div>
                  )}
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
