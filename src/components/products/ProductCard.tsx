import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, Heart, Share2, Eye, Plus, Minus } from 'lucide-react';
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
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen, baseYen, hasDiscount, getVariants } from '@/utils/pricing';
import { convertYen as fxConvert } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';

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
  const [showDescription, setShowDescription] = useState(false);
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, language, selectedCountry } = useLanguage();

  // Nome do produto fica no idioma original salvo (normalmente inglês). Só a descrição é traduzida.
  const translatedName = productEnglishName(product);
  const translatedDesc = i18nDesc(product, language) || getTranslatedProductDesc(product.id, t);
  const translatedFlavor = getTranslatedProductFlavor(product.id, t);
  const descriptionText = translatedDesc?.trim() || '';
  const hasDescription = descriptionText.length > 0;
  const shouldCollapseDescription = descriptionText.length > 120;

  useEffect(() => {
    if (user?.email) {
      setIsFavorite(wishlistService.isInWishlist(user.email, product.id));
    }
  }, [user, product.id]);

  const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(selectedCountry);
  const currency = getCurrencyByCountry(selectedCountry);

  const convertYen = (yen: number) => fxConvert(yen, currency);
  const getDisplayPrice = (size: string) => convertYen(effectiveYen(product, size));

  const multiVariant = variants.length > 1;
  const currentPrice = getDisplayPrice(selectedSize);
  const promoActive = hasDiscount(product);
  const originalPrice = convertYen(baseYen(product, selectedSize));
  const isSoldOut = product.stock && !product.stock.unlimited && product.stock.quantity === 0;

  // Verifica restrição de destino
  const isJapanDest = selectedCountry === 'Japão';
  const deliveryBlocked =
    (product.deliveryRestrict === 'exterior-only' && isJapanDest) ||
    (product.deliveryRestrict === 'japan-only' && !isJapanDest);
  const deliveryBlockMsgs: Record<string, Record<string, string>> = {
    'exterior-only': { pt: 'Vendas somente para fora do Japão', en: 'Sales for overseas only', ja: '海外への販売のみ' },
    'japan-only':    { pt: 'Disponível somente dentro do Japão', en: 'Available within Japan only', ja: '日本国内のみ対応' },
  };
  const lang = (language || 'pt') as string;
  const deliveryBlockMsg = product.deliveryRestrict
    ? (deliveryBlockMsgs[product.deliveryRestrict]?.[lang] || deliveryBlockMsgs[product.deliveryRestrict]?.pt)
    : '';

  const deliveryFaixaMsgs: Record<string, Record<string, string>> = {
    'exterior-only': { pt: 'Vendas somente para fora do Japão', en: 'Overseas only', ja: '海外発送のみ' },
    'japan-only':    { pt: 'Somente dentro do Japão', en: 'Japan only', ja: '日本国内のみ' },
  };
  const deliveryFaixaMsg = product.deliveryRestrict
    ? (deliveryFaixaMsgs[product.deliveryRestrict]?.[lang] || deliveryFaixaMsgs[product.deliveryRestrict]?.pt)
    : '';

  const handleAddToCart = () => {
    if (deliveryBlocked) {
      toast({ title: '🚫 ' + deliveryBlockMsg, variant: 'destructive' });
      return;
    }
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
        productName: translatedName,
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
          <>
            {/* Poster sempre visível — vídeo só carrega/toca no hover para não travar a página */}
            <img
              src={product.thumbnail || product.image}
              alt={translatedName}
              loading="lazy"
              decoding="async"
              width={300}
              height={300}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${isHovered ? 'opacity-0' : 'opacity-100'}`}
            />
            {isHovered && (
              <video
                key={product.video}
                src={product.video}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
              />
            )}
          </>
        ) : (product.thumbnail || product.image) ? (
          <img
            src={product.thumbnail || product.image}
            alt={translatedName}
            loading="lazy"
            decoding="async"
            width={300}
            height={300}
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

        {/* Sold Out corner ribbon (top-left) */}
        {isSoldOut && (
          <div className="absolute top-0 left-0 z-30 pointer-events-none overflow-hidden w-48 h-48">
            <div
              className="absolute bg-red-600 text-white text-sm font-black tracking-widest text-center shadow-xl"
              style={{ transform: 'rotate(-45deg)', width: '220px', top: '44px', left: '-52px', paddingTop: '10px', paddingBottom: '10px' }}
            >
              SOLD OUT
            </div>
          </div>
        )}

        {/* Promo gift badge */}
        {product.promoGift && product.promoGift.buyQuantity > 0 && product.promoGift.giftProductId && !isSoldOut && (
          <div className="absolute bottom-14 left-2 z-20 max-w-[90%]">
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600 text-white shadow leading-tight block">
              🎁 Compre {product.promoGift.buyQuantity}x{product.promoGift.minOrderValueYen ? ` + gaste ${formatPrice(convertYen(product.promoGift.minOrderValueYen), currency)}` : ''} → ganhe {product.promoGift.giftProductName}
            </span>
          </div>
        )}

        {/* Category Badge */}
        <div className={cn('absolute left-4 z-10 flex flex-col gap-1', promoActive ? 'top-14' : 'top-4')}>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-primary text-primary-foreground shadow-sm">
            {t(`product.category.${['cosmeticos','acessorios','doces','papelaria','eletronicos','masculino','vestuario','higiene'].includes(product.category || '') ? product.category : 'importado'}`)}
          </span>
          {product.origin === 'importado' && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-600 text-white shadow-sm w-fit">
              📦 Importado
            </span>
          )}
        </div>

        {/* Aviso de restrição de destino */}
        {deliveryBlocked && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-red-600/90 text-white text-[10px] font-bold text-center py-1 px-2">
            🚫 {deliveryFaixaMsg}
          </div>
        )}

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
        {hasDescription && (
          <div className="mb-3 hidden sm:block">
            <p
              className={cn(
                "text-xs text-muted-foreground leading-relaxed transition-all",
                showDescription
                  ? "max-h-40 overflow-y-auto pr-1"
                  : "max-h-10 overflow-hidden"
              )}
            >
              {descriptionText}
            </p>
            {shouldCollapseDescription && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDescription((v) => !v);
                }}
                className="mt-1 text-[11px] font-semibold text-primary hover:text-primary/80"
              >
                {showDescription ? t('product.hideDesc') : t('product.showDesc')}
              </button>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto mb-2.5">
          {multiVariant && <span className="block text-[10px] text-muted-foreground leading-none mb-0.5">{t('product.from')}</span>}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={cn('text-lg font-extrabold leading-none', promoActive ? 'text-red-600' : 'text-primary')}>
              {formatPrice(currentPrice, currency)}
            </span>
            {promoActive && (
              <span className="text-xs font-semibold text-gray-400 line-through">{formatPrice(originalPrice, currency)}</span>
            )}
          </div>
        </div>

        {/* Quantity selector + Add to cart */}
        {isSoldOut ? (
          <Button size="sm" disabled className="w-full rounded-lg h-9 bg-red-100 text-red-600 cursor-not-allowed text-xs font-bold border border-red-300 hover:bg-red-100">
            {t('product.outOfStock')}
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Qty row */}
            <div className="flex items-center justify-between border border-border rounded-lg overflow-hidden">
              <button
                onClick={(e) => { e.stopPropagation(); setQuantity(q => Math.max(1, q - 1)); }}
                className="flex-1 py-1.5 hover:bg-secondary/50 transition-colors flex items-center justify-center"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 text-sm font-semibold border-x border-border">{quantity}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const maxQty = product.stock && !product.stock.unlimited ? product.stock.quantity : Infinity;
                  setQuantity(q => Math.min(q + 1, maxQty));
                }}
                disabled={!!(product.stock && !product.stock.unlimited && quantity >= product.stock.quantity)}
                className={cn('flex-1 py-1.5 hover:bg-secondary/50 transition-colors flex items-center justify-center', product.stock && !product.stock.unlimited && quantity >= product.stock.quantity && 'opacity-30 cursor-not-allowed')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Add button — full width */}
            <Button
              onClick={handleAddToCart}
              size="sm"
              className={cn('w-full rounded-lg transition-all btn-primary text-xs font-bold h-9', added && 'bg-accent hover:bg-accent')}
            >
              {added ? (
                <><Check className="w-4 h-4 mr-1" /> {t('productDetail.added')}</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-1" /> {t('product.addShort')}</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
