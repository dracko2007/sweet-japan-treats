import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product } from '@/types';
import { productService } from '@/services/productService';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

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
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregamento inicial: tenta cache primeiro (instantâneo).
  // Se retornar vazio (auth Firebase ainda não pronta), tenta de novo em 3s.
  useEffect(() => {
    let cancelled = false;

    const load = async (attempt = 0) => {
      if (attempt === 0) setLoading(true);
      try {
        const merged = await productService.getMerged(attempt > 0);
        if (cancelled) return;
        if (merged.length > 0) {
          setProducts(merged);
          setLoading(false);
        } else if (attempt === 0) {
          // Vazio na 1ª tentativa → Firebase Auth pode não estar pronta ainda, tenta em 3s
          setTimeout(() => { if (!cancelled) load(1); }, 3000);
        } else {
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        if (attempt === 0) {
          // Erro na 1ª tentativa → Firebase Auth pode não estar pronta, tenta em 3s
          setTimeout(() => { if (!cancelled) load(1); }, 3000);
        } else {
          setLoading(false);
        }
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
