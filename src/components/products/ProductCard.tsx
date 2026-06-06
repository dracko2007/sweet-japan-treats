import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, Heart, Share2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { wishlistService } from '@/services/wishlistService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslatedProductDesc, getTranslatedProductFlavor } from '@/data/translations';
import { i18nDesc } from '@/utils/productI18n';
import { formatPrice } from '@/utils/currency';
import { effectiveYen, baseYen, hasDiscount, getVariants } from '@/utils/pricing';
import { convertYen as fxConvert } from '@/services/fxService';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const variants = getVariants(product);
  // Mais barata primeiro (para "a partir de" e o que vai ao carrinho pelo card)
  const firstVariant = [...variants].sort((a, b) => a.price - b.price)[0];
  const [selectedSize] = useState<string>(firstVariant?.id || 'small');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, language, selectedCountry } = useLanguage();

  // Nome do produto fica no idioma original salvo (normalmente inglês). Só a descrição é traduzida.
  const translatedName = product.name;
  const translatedDesc = i18nDesc(product, language) || getTranslatedProductDesc(product.id, t);
  const translatedFlavor = getTranslatedProductFlavor(product.id, t);

  useEffect(() => {
    if (user?.email) {
      setIsFavorite(wishlistService.isInWishlist(user.email, product.id));
    }
  }, [user, product.id]);

  const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(selectedCountry);
  const currency = selectedCountry === 'Japão' ? 'JPY' : (isEuro ? 'EUR' : 'BRL');

  const convertYen = (yen: number) => fxConvert(yen, currency);
  const getDisplayPrice = (size: string) => convertYen(effectiveYen(product, size));

  const multiVariant = variants.length > 1;
  const currentPrice = getDisplayPrice(selectedSize);
  const promoActive = hasDiscount(product);
  const originalPrice = convertYen(baseYen(product, selectedSize));

  const handleAddToCart = () => {
    addToCart(product, selectedSize, quantity, firstVariant?.label);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    setQuantity(1);
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
        description: translatedName,
      });
    } else {
      const success = wishlistService.addToWishlist(user.email, {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productPrice: product.prices.small,
      });

      if (success) {
        setIsFavorite(true);
        toast({
          title: t('productDetail.addedFavorite'),
          description: translatedName,
        });
      }
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/produtos`;
    const text = `${translatedName} 🌸`;

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
    <div className="card-product group h-full flex flex-col">
      {/* Image/Video */}
      <div 
        className="aspect-square bg-secondary/50 relative overflow-hidden cursor-pointer group/image"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => navigate(`/produto/${product.id}`)}
      >
        {product.video ? (
          <video 
            key={product.video}
            src={product.video} 
            autoPlay 
            loop 
            muted 
            playsInline
            poster={product.image}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const videoElement = e.target as HTMLVideoElement;
              videoElement.style.display = 'none';
              const imgElement = document.createElement('img');
              imgElement.src = product.image;
              imgElement.alt = translatedName;
              imgElement.className = 'absolute inset-0 w-full h-full object-cover';
              videoElement.parentElement?.appendChild(imgElement);
            }}
          />
        ) : product.image ? (
          <img
            src={product.image}
            alt={translatedName}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-caramel-light/40 to-primary/30 flex items-center justify-center">
            <span className="text-7xl opacity-80 group-hover:scale-110 transition-transform duration-500">🍯</span>
          </div>
        )}
        
        {/* Tag de desconto (promoção) */}
        {promoActive && (
          <div className="absolute top-4 left-4 z-20">
            <span className="px-3 py-1.5 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-md animate-pulse">
              -{product.discountPercent}% OFF
            </span>
          </div>
        )}

        {/* Category Badge */}
        <div className={cn('absolute left-4 z-10', promoActive ? 'top-14' : 'top-4')}>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-primary text-primary-foreground shadow-sm">
            {product.category === 'cosmeticos' ? 'Cosméticos 🧴' :
             product.category === 'acessorios' ? 'Acessórios 🎮' :
             product.category === 'doces' ? 'Doces & Chás 🍵' :
             product.category === 'papelaria' ? 'Papelaria ✏️' :
             product.category === 'eletronicos' ? 'Eletrônicos 📱' :
             product.category === 'masculino' ? 'Masculino 👔' :
             product.category === 'vestuario' ? 'Vestuário 👕' :
             product.category === 'higiene' ? 'Higiene & Saúde 🧼' : 'Importado 🌸'}
          </span>
        </div>

        {/* Favorite & Share Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
            className={cn(
              "p-2 rounded-full backdrop-blur-sm transition-all",
              isFavorite 
                ? "bg-red-500 text-white hover:bg-red-600" 
                : "bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800"
            )}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm transition-all"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* View Details Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
          <div className="text-white text-center">
            <Eye className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">{t('productDetail.viewDetails')}</p>
          </div>
        </div>

        {/* Flavor tag */}
        <div className="absolute bottom-4 right-4 z-10">
          <span className="px-3 py-1 rounded-full bg-card/90 text-sm font-medium text-foreground">
            {translatedFlavor}
          </span>
        </div>
      </div>

      {/* Content (compacto) */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-display text-sm sm:text-base font-bold text-foreground mb-1 line-clamp-2 leading-snug">
          {translatedName}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 hidden sm:block">
          {translatedDesc}
        </p>

        {/* Price */}
        <div className="mt-auto mb-2.5">
          {multiVariant && <span className="block text-[10px] text-muted-foreground leading-none mb-0.5">a partir de</span>}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={cn('text-lg font-extrabold leading-none', promoActive ? 'text-red-600' : 'text-primary')}>
              {formatPrice(currentPrice, currency)}
            </span>
            {promoActive && (
              <span className="text-xs font-semibold text-gray-400 line-through">{formatPrice(originalPrice, currency)}</span>
            )}
          </div>
        </div>

        {/* Add to cart */}
        <Button
          onClick={handleAddToCart}
          size="sm"
          className={cn('w-full rounded-lg transition-all btn-primary text-xs sm:text-sm h-9', added && 'bg-accent hover:bg-accent')}
        >
          {added ? (
            <><Check className="w-4 h-4 mr-1.5" /> {t('productDetail.added')}</>
          ) : (
            <><ShoppingCart className="w-4 h-4 mr-1.5" /> Adicionar</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
