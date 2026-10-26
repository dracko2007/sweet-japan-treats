import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Plus, Star } from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen, baseYen, hasDiscount, getVariants } from '@/utils/pricing';
import { convertYen as fxConvert } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';
import { cdnVideo } from '@/services/cloudinaryService';
import { wishlistService } from '@/services/wishlistService';
import { useWishlist } from '@/hooks/useWishlist';
import { useTilt } from '@/hooks/useTilt';
import { ToastAction } from '@/components/ui/toast';

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
  const { addToCart, items: cartItems } = useCart();
  const { user } = useUser();
  const { toast } = useToast();
  const { selectedCountry } = useLanguage();
  const wishlist = useWishlist(user?.id);
  const isFavorite = wishlist.some((w) => w.productId === product.id);
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  const tilt = useTilt();

  const variants = getVariants(product);
  const firstVariant = [...variants].sort((a, b) => a.price - b.price)[0];
  const currency = getCurrencyByCountry(selectedCountry);
  const convertYen = (yen: number) => fxConvert(yen, currency);

  const promoActive = hasDiscount(product);
  const price = convertYen(effectiveYen(product, firstVariant?.id || 'small'));
  const originalPrice = convertYen(baseYen(product, firstVariant?.id || 'small'));
  const isSoldOut = product.stock && !product.stock.unlimited && product.stock.quantity === 0;
  const name = productEnglishName(product);
  const cartQuantity = cartItems
    .filter((item) => item.product.id === product.id && !item.freeGift)
    .reduce((sum, item) => sum + item.quantity, 0);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({
        title: 'Entre para salvar seus favoritos',
        description: 'Leva poucos segundos e sua lista fica salva em qualquer aparelho.',
        action: (
          <ToastAction altText="Entrar" onClick={() => navigate('/login', { state: { from: location.pathname } })}>
            Entrar
          </ToastAction>
        ),
      });
      return;
    }
    if (isFavorite) {
      wishlistService.removeFromWishlist(user.id, product.id);
    } else {
      wishlistService.addToWishlist(user.id, {
        productId: product.id,
        productName: name,
        productImage: product.image,
        productPrice: product.prices.small,
      });
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut) return;
    addToCart(product, firstVariant?.id || 'small', 1, firstVariant?.label);
    toast({ title: 'Adicionado ao carrinho', description: name });
  };

  const openProduct = () => navigate(`/produto/${product.id}`);

  return (
    <motion.article
      onClick={openProduct}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openProduct();
        }
      }}
      {...tilt.handlers}
      style={tilt.cardStyle}
      whileTap={tilt.enabled ? undefined : { scale: 0.97 }}
      role="link"
      tabIndex={0}
      aria-label={`${name} — ${formatPrice(price, currency)}`}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-pink-100/60 bg-white shadow-sm transition-[box-shadow,border-color] duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 hover:z-10 hover:border-pink-300 hover:shadow-2xl hover:shadow-pink-300/50"
    >
      <div
        className="relative aspect-square overflow-hidden bg-gradient-to-br from-white via-pink-50/35 to-fuchsia-50/50 transition-colors duration-500 group-hover:from-pink-50 group-hover:via-fuchsia-50 group-hover:to-pink-100/80"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Camada da mídia: desliza contra a inclinação (parallax) — dá a profundidade. */}
        <motion.div className="absolute -inset-2" style={tilt.innerStyle}>
          {product.video && product.videoCover ? (
            /* Vídeo é a capa — toca direto, sem precisar de hover. Poster cobre
               até o vídeo carregar. Passa por `cdnVideo`: o card tem ~300px, mas
               o arquivo original tem 2,4 MB e era baixado inteiro na home. */
            <video
              key={product.video}
              src={cdnVideo(product.video, 480)}
              poster={product.thumbnail || product.image}
              preload="none"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
            />
          ) : product.video ? (
            <>
              {/* Poster sempre visível — vídeo só carrega/toca no hover para não travar a página */}
              <img
                src={product.thumbnail || product.image}
                alt={name}
                loading="lazy"
                className={`absolute inset-0 h-full w-full object-contain p-5 transition-all duration-500 group-hover:scale-[1.04] ${isHovered ? 'opacity-0' : 'opacity-100'}`}
              />
              {isHovered && (
                <video
                  key={product.video}
                  src={cdnVideo(product.video, 480)}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                />
              )}
            </>
          ) : (
            <img
              src={product.thumbnail || product.image}
              alt={name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain p-5 drop-shadow-[0_10px_12px_rgba(157,23,77,0.10)] transition-transform duration-500 group-hover:scale-[1.08]"
            />
          )}
        </motion.div>
        {/* Brilho de vidro que acompanha o mouse (só no computador). */}
        <motion.div
          className="pointer-events-none absolute inset-0 mix-blend-soft-light"
          style={tilt.glareStyle}
          aria-hidden="true"
        />
        {promoActive && (
          <span className="absolute left-2 top-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 px-2 py-1 text-[10px] font-black text-white shadow-md">
            -{product.discountPercent}%
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleFavorite}
          className={cn(
            'absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-lg transition-all duration-300 hover:scale-110 active:scale-95',
            isFavorite
              ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/40'
              : 'bg-white/90 text-slate-600 shadow-md ring-1 ring-white/90 hover:bg-white hover:text-pink-500 hover:shadow-lg'
          )}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={isFavorite}
        >
          <Heart className={cn('h-5 w-5 transition-all', isFavorite && 'animate-[pop_0.35s_ease-out] fill-current')} />
        </button>
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="text-[11px] font-black text-red-600">ESGOTADO</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 bg-gradient-to-b from-transparent to-pink-50/30 p-3 transition-colors duration-300 group-hover:to-pink-100/50 sm:p-3.5">
        <p className="min-h-[2.5em] text-[13px] font-bold leading-snug text-slate-800 line-clamp-2 transition-colors group-hover:text-pink-700">{name}</p>
        {(product.rating || product.salesCount) ? (
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            {product.rating ? (
              <span className="flex items-center gap-0.5 font-bold text-amber-500">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {product.rating.toFixed(1)}
              </span>
            ) : null}
            {product.rating && product.salesCount ? <span className="text-gray-300">·</span> : null}
            {product.salesCount ? <span>{formatCount(product.salesCount)} vendidos</span> : null}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-1 pt-1">
          <div className="min-w-0">
            <p className={cn('text-base font-black leading-none tracking-tight', promoActive ? 'text-red-600' : 'text-pink-600')}>
              {formatPrice(price, currency)}
            </p>
            {promoActive && (
              <p className="mt-0.5 text-[10px] leading-none text-gray-400 line-through">
                {formatPrice(originalPrice, currency)}
              </p>
            )}
          </div>
          {!isSoldOut && (
            <button
              type="button"
              onClick={handleAddToCart}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-500/30 transition-all duration-300 hover:-rotate-6 hover:scale-110 hover:shadow-xl active:scale-90"
              aria-label={cartQuantity > 0 ? `Adicionar mais — ${cartQuantity} no carrinho` : 'Adicionar ao carrinho'}
            >
              <Plus className="h-5 w-5" />
              {cartQuantity > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-orange-500 px-1 text-[10px] font-black text-white shadow-md">
                  {cartQuantity}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
};

export default CompactProductCard;
