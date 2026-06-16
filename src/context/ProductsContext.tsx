import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product } from '@/types';
import { productService } from '@/services/productService';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


interface ProductsContextValue {
  products: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue>({
  products: [],
  loading: true,
  refresh: async () => {},
});

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // refresh() sempre vai ao Firestore (ignora cache) — usado por botões manuais e após salvar
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const merged = await productService.getMerged(true);
      setProducts(merged);
    } catch (e) {
      devWarn('ProductsContext refresh falhou:', e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregamento inicial: tenta cache (instantâneo); se vazio ou expirado vai ao Firestore
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const merged = await productService.getMerged(false); // usa cache se disponível
        if (!cancelled) setProducts(merged);
        // Se cache retornou 0 produtos, força fetch no Firestore
        if (!cancelled && merged.length === 0) {
          const fresh = await productService.getMerged(true);
          if (!cancelled) setProducts(fresh);
        }
      } catch (e) {
        devWarn('ProductsContext load falhou:', e);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ProductsContext.Provider value={{ products, loading, refresh }}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => useContext(ProductsContext);
