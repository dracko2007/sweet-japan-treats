import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Plus, Star } from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { wishlistService } from '@/services/wishlistService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen, baseYen, hasDiscount, getVariants } from '@/utils/pricing';
import { convertYen as fxConvert } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';

interface CompactProductCardProps {
  product: Product;
}

/** Formata contagem grande de forma compacta (ex: 1234 -> "1.2K"). */
const formatCount = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
};

/** Card denso estilo Temu: só imagem, nome, preço e ações mínimas — para grades com muitos itens por linha. */
const CompactProductCard: React.FC<CompactProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();
  const { selectedCountry } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (user?.email) setIsFavorite(wishlistService.isInWishlist(user.email, product.id));
  }, [user, product.id]);

  const variants = getVariants(product);
  const firstVariant = [...variants].sort((a, b) => a.price - b.price)[0];
  const currency = getCurrencyByCountry(selectedCountry);
  const convertYen = (yen: number) => fxConvert(yen, currency);

  const promoActive = hasDiscount(product);
  const price = convertYen(effectiveYen(product, firstVariant?.id || 'small'));
  const originalPrice = convertYen(baseYen(product, firstVariant?.id || 'small'));
  const isSoldOut = product.stock && !product.stock.unlimited && product.stock.quantity === 0;
  const name = productEnglishName(product);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.email) {
      toast({ title: 'Entre para favoritar', variant: 'destructive' });
      return;
    }
    if (isFavorite) {
      wishlistService.removeFromWishlist(user.email, product.id);
      setIsFavorite(false);
    } else {
      wishlistService.addToWishlist(user.email, {
        productId: product.id,
        productName: name,
        productImage: product.image,
        productPrice: product.prices.small,
      });
      setIsFavorite(true);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut) return;
    addToCart(product, firstVariant?.id || 'small', 1, firstVariant?.label);
    toast({ title: 'Adicionado ao carrinho', description: name });
  };

  return (
    <div
      onClick={() => navigate(`/produto/${product.id}`)}
      className="group cursor-pointer bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        <img
          src={product.thumbnail || product.image}
          alt={name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {promoActive && (
          <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
            -{product.discountPercent}%
          </span>
        )}
        <button
          onClick={handleToggleFavorite}
          className={cn(
            'absolute top-1.5 right-1.5 p-1.5 rounded-full backdrop-blur-sm transition-colors',
            isFavorite ? 'bg-pink-500 text-white' : 'bg-white/85 text-gray-500 hover:text-pink-500'
          )}
        >
          <Heart className={cn('w-3.5 h-3.5', isFavorite && 'fill-current')} />
        </button>
        {isSoldOut && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[11px] font-black text-red-600">ESGOTADO</span>
          </div>
        )}
      </div>

      <div className="p-2 flex flex-col flex-1">
        <p className="text-xs text-gray-700 font-medium line-clamp-2 leading-snug mb-1 min-h-[2.2em]">{name}</p>
        {(product.rating || product.salesCount) ? (
          <div className="flex items-center gap-1 mb-1.5 text-[10px] text-gray-500">
            {product.rating ? (
              <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {product.rating.toFixed(1)}
              </span>
            ) : null}
            {product.rating && product.salesCount ? <span className="text-gray-300">·</span> : null}
            {product.salesCount ? <span>{formatCount(product.salesCount)} vendidos</span> : null}
          </div>
        ) : (
          <div className="mb-1.5" />
        )}
        <div className="mt-auto flex items-end justify-between gap-1">
          <div>
            <p className={cn('text-sm font-bold leading-none', promoActive ? 'text-red-600' : 'text-pink-600')}>
              {formatPrice(price, currency)}
            </p>
            {promoActive && (
              <p className="text-[10px] text-gray-400 line-through leading-none mt-0.5">
                {formatPrice(originalPrice, currency)}
              </p>
            )}
          </div>
          {!isSoldOut && (
            <button
              onClick={handleAddToCart}
              className="shrink-0 w-6 h-6 rounded-full bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center transition-colors"
              aria-label="Adicionar ao carrinho"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompactProductCard;
