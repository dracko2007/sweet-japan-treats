import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { CartItem, Product } from '@/types';
import { safeStorage } from '@/utils/storage';
import { effectiveYen } from '@/utils/pricing';
import { useProducts } from '@/context/ProductsContext';

const CART_STORAGE_KEY = 'sakura_cart';

const loadCart = (): CartItem[] => {
  try {
    const raw = safeStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.filter((i: CartItem) => !i.freeGift); // strip stale gift items on load
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
  const [rawItems, setRawItems] = useState<CartItem[]>(loadCart);
  const { products } = useProducts();

  // Persist only non-gift items to localStorage
  useEffect(() => {
    safeStorage.setItem(CART_STORAGE_KEY, JSON.stringify(rawItems));
  }, [rawItems]);

  // Gift items are fully derived — no state, no loops
  const giftItems = useMemo<CartItem[]>(() => {
    if (!products.length) return [];
    const totalYen = rawItems.reduce((s, i) => s + effectiveYen(i.product, i.size) * i.quantity, 0);
    const gifts: CartItem[] = [];
    const addedGiftIds = new Set<string>();
    for (const item of rawItems) {
      const pg = item.product.promoGift;
      if (!pg || pg.buyQuantity <= 0 || !pg.giftProductId) continue;
      if (item.quantity < pg.buyQuantity) continue;
      if (pg.minOrderValueYen && totalYen < pg.minOrderValueYen) continue;
      if (addedGiftIds.has(pg.giftProductId)) continue;
      const giftProduct = products.find(p => p.id === pg.giftProductId);
      if (!giftProduct) continue;
      addedGiftIds.add(pg.giftProductId);
      gifts.push({
        product: giftProduct,
        size: 'small',
        quantity: 1,
        variantLabel: 'Presente 🎁',
        freeGift: true,
        freeGiftFromProductId: item.product.id,
      });
    }
    return gifts;
  }, [rawItems, products]);

  // All items exposed to consumers = regular + auto-gifts
  const items = useMemo(() => [...rawItems, ...giftItems], [rawItems, giftItems]);

  const addToCart = useCallback((product: Product, size: string, quantity = 1, variantLabel?: string) => {
    setRawItems(prev => {
      const maxQty = product.stock && !product.stock.unlimited ? product.stock.quantity : Infinity;
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && item.size === size
      );
      if (existingIndex >= 0) {
        const newQty = Math.min(prev[existingIndex].quantity + quantity, maxQty);
        if (newQty === prev[existingIndex].quantity) return prev;
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      const newQty = Math.min(quantity, maxQty);
      if (newQty <= 0) return prev;
      return [...prev, { product, size, quantity: newQty, variantLabel }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, size: string) => {
    setRawItems(prev => prev.filter(
      item => !(item.product.id === productId && item.size === size)
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      setRawItems(prev => prev.filter(
        item => !(item.product.id === productId && item.size === size)
      ));
      return;
    }
    setRawItems(prev => prev.map(item => {
      if (item.product.id !== productId || item.size !== size) return item;
      const maxQty = item.product.stock && !item.product.stock.unlimited ? item.product.stock.quantity : Infinity;
      return { ...item, quantity: Math.min(quantity, maxQty) };
    }));
  }, []);

  const clearCart = useCallback(() => {
    setRawItems([]);
  }, []);

  // Limpa o carrinho quando o usuário faz logout (evento disparado pelo UserContext)
  useEffect(() => {
    const onLogout = () => setRawItems([]);
    window.addEventListener('japan-express:logout', onLogout);
    return () => window.removeEventListener('japan-express:logout', onLogout);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  // Price excludes free gifts
  const totalPrice = useMemo(
    () => rawItems.reduce((sum, item) => sum + effectiveYen(item.product, item.size) * item.quantity, 0),
    [rawItems]
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
