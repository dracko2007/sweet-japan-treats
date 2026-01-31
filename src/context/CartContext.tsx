import React, { createContext, useContext, useState, useCallback } from 'react';
import { CartItem, Product } from '@/types';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size: 'small' | 'large', quantity?: number) => void;
  removeFromCart: (productId: string, size: 'small' | 'large') => void;
  updateQuantity: (productId: string, size: 'small' | 'large', quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getSpaceUsed: () => { small: number; large: number; totalSmallEquivalent: number };
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((product: Product, size: 'small' | 'large', quantity = 1) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && item.size === size
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        };
        return updated;
      }

      return [...prev, { product, size, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, size: 'small' | 'large') => {
    setItems(prev => prev.filter(
      item => !(item.product.id === productId && item.size === size)
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, size: 'small' | 'large', quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }
    
    setItems(prev => prev.map(item => 
      item.product.id === productId && item.size === size
        ? { ...item, quantity }
        : item
    ));
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = items.reduce((sum, item) => {
    const price = item.size === 'small' ? item.product.prices.small : item.product.prices.large;
    return sum + price * item.quantity;
  }, 0);

  // Calculate space used (1 large = 2 small)
  const getSpaceUsed = useCallback(() => {
    let small = 0;
    let large = 0;
    
    items.forEach(item => {
      if (item.size === 'small') {
        small += item.quantity;
      } else {
        large += item.quantity;
      }
    });

    return {
      small,
      large,
      totalSmallEquivalent: small + (large * 2)
    };
  }, [items]);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      getSpaceUsed
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
