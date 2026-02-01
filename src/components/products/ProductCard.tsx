import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, Check, Heart, Share2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { wishlistService } from '@/services/wishlistService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const [selectedSize, setSelectedSize] = useState<'small' | 'large'>('small');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { addToCart } = useCart();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.email) {
      setIsFavorite(wishlistService.isInWishlist(user.email, product.id));
    }
  }, [user, product.id]);

  const currentPrice = selectedSize === 'small' ? product.prices.small : product.prices.large;

  const handleAddToCart = () => {
    addToCart(product, selectedSize, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    setQuantity(1);
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
      const success = wishlistService.addToWishlist(user.email, {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productPrice: product.prices.small,
      });

      if (success) {
        setIsFavorite(true);
        toast({
          title: "Adicionado aos favoritos! ❤️",
          description: `${product.name} salvo na sua lista de desejos`,
        });
      }
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/produtos`;
    const text = `Confira ${product.name} - Doce de Leite Artesanal 🍯`;

    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: text,
        url: url,
      }).catch(() => {
        // Fallback se cancelar
      });
    } else {
      // Fallback: copiar link
      navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para sua área de transferência",
      });
    }

        {/* Favorite & Share Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite();
            }}
            className={cn(
              "p-2 rounded-full backdrop-blur-sm transition-all",
              isFavorite 
                ? "bg-red-500 text-white hover:bg-red-600" 
                : "bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800"
            )}
            title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm transition-all"
            title="Compartilhar produto"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* View Details Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
          <div className="text-white text-center">
            <Eye className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Ver Detalhes</p>
          </div>
        </div>
  };

  return (
    <div className="card-product group">
      {/* Image/Video */}
      <div  cursor-pointer group/image"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => navigate(`/produto/${product.id}`}
        onMouseLeave={() => setIsHovered(false)}
      >
        {product.video ? (
          <>
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
                console.error('Erro ao carregar vídeo:', product.video, e);
                const videoElement = e.target as HTMLVideoElement;
                videoElement.style.display = 'none';
                // Mostra a imagem se o vídeo falhar
                const imgElement = document.createElement('img');
                imgElement.src = product.image;
                imgElement.alt = product.name;
                imgElement.className = 'absolute inset-0 w-full h-full object-cover';
                videoElement.parentElement?.appendChild(imgElement);
              }}
            />
          </>
        ) : product.image ? (
          <img 
            src={product.image} 
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-caramel-light/40 to-primary/30 flex items-center justify-center">
            <span className="text-7xl opacity-80 group-hover:scale-110 transition-transform duration-500">🍯</span>
          </div>
        )}
        
        {/* Category Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide",
            product.category === 'premium' 
              ? 'bg-gold/90 text-chocolate' 
              : 'bg-primary text-primary-foreground'
          )}>
            {product.category === 'premium' ? '★ Premium' : 'Artesanal'}
          </span>
        </div>

        {/* Flavor tag */}
        <div className="absolute bottom-4 right-4 z-10">
          <span className="px-3 py-1 rounded-full bg-card/90 text-sm font-medium text-foreground">
            {product.flavor}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {product.description}
        </p>

        {/* Size Selection */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setSelectedSize('small')}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all",
              selectedSize === 'small'
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            280g - ¥{product.prices.small.toLocaleString()}
          </button>
          <button
            onClick={() => setSelectedSize('large')}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all",
              selectedSize === 'large'
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            800g - ¥{product.prices.large.toLocaleString()}
          </button>
        </div>

        {/* Quantity & Add to Cart */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border rounded-lg">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="p-2 hover:bg-secondary/50 transition-colors rounded-l-lg"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-10 text-center font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="p-2 hover:bg-secondary/50 transition-colors rounded-r-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <Button 
            onClick={handleAddToCart}
            className={cn(
              "flex-1 rounded-lg transition-all btn-primary",
              added && "bg-accent hover:bg-accent"
            )}
          >
            {added ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Adicionado!
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 mr-2" />
                ¥{(currentPrice * quantity).toLocaleString()}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
