import React from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem as CartItemType } from '@/types';
import { useCart } from '@/context/CartContext';

interface CartItemProps {
  item: CartItemType;
}

const CartItemComponent: React.FC<CartItemProps> = ({ item }) => {
  const { updateQuantity, removeFromCart } = useCart();
  const price = item.size === 'small' ? item.product.prices.small : item.product.prices.large;

  return (
    <div className="flex gap-4 p-4 bg-card rounded-xl border border-border">
      {/* Image */}
      <div className="w-24 h-24 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
        <span className="text-4xl">🍯</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display font-semibold text-foreground truncate">
              {item.product.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {item.size === 'small' ? '280g' : '800g'} • {item.product.flavor}
            </p>
            <span className={`
              inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium
              ${item.product.category === 'premium' 
                ? 'bg-gold/20 text-caramel-dark' 
                : 'bg-primary/10 text-primary'
              }
            `}>
              {item.product.category === 'premium' ? 'Premium' : 'Artesanal'}
            </span>
          </div>
          
          <button
            onClick={() => removeFromCart(item.product.id, item.size)}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3">
          {/* Quantity controls */}
          <div className="flex items-center border border-border rounded-lg">
            <button
              onClick={() => updateQuantity(item.product.id, item.size, item.quantity - 1)}
              className="p-1.5 hover:bg-secondary/50 transition-colors rounded-l-lg"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
            <button
              onClick={() => updateQuantity(item.product.id, item.size, item.quantity + 1)}
              className="p-1.5 hover:bg-secondary/50 transition-colors rounded-r-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Price */}
          <p className="font-display text-lg font-bold text-primary">
            ¥{(price * item.quantity).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CartItemComponent;
