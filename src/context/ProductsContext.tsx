import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product } from '@/types';
import { products as defaultProducts } from '@/data/products';
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
  products: defaultProducts,
  loading: false,
  refresh: async () => {},
});

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Começa com os defaults para a loja nunca ficar vazia/quebrada.
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const merged = await productService.getMerged();
      if (merged.length > 0) setProducts(merged);
    } catch (e) {
      devWarn('ProductsContext refresh falhou, usando defaults:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ProductsContext.Provider value={{ products, loading, refresh }}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => useContext(ProductsContext);
