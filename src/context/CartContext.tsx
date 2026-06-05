import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { CartItem, Product } from '@/types';
import { safeStorage } from '@/utils/storage';
import { effectiveYen } from '@/utils/pricing';

const CART_STORAGE_KEY = 'sakura_cart';

// Carrega o carrinho salvo (persiste entre recarregamentos da página)
const loadCart = (): CartItem[] => {
  try {
    const raw = safeStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size: string, quantity?: number, variantLabel?: string) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getSpaceUsed: () => { small: number; large: number; totalSmallEquivalent: number };
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  // Persiste o carrinho a cada mudança
  useEffect(() => {
    safeStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = useCallback((product: Product, size: string, quantity = 1, variantLabel?: string) => {
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

      return [...prev, { product, size, quantity, variantLabel }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, size: string) => {
    setItems(prev => prev.filter(
      item => !(item.product.id === productId && item.size === size)
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, size: string, quantity: number) => {
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

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + effectiveYen(item.product, item.size) * item.quantity, 0),
    [items]
  );

  const getSpaceUsed = useCallback(() => {
    let small = 0;
    let large = 0;
    items.forEach(item => {
      if (item.size === 'small') small += item.quantity;
      else large += item.quantity;
    });
    return { small, large, totalSmallEquivalent: small + large * 2 };
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
