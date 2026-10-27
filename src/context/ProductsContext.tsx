import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Product } from '@/types';
import { productService } from '@/services/productService';
import { loadProductCosts, mergeAdminProducts, withCosts } from '@/services/productCostService';
import { useUser } from '@/context/UserContext';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

interface ProductsContextValue {
  /** Vitrine: só produtos publicados (custo junto quando a conta é admin). */
  products: Product[];
  /** Painel admin: os publicados + os ocultos. Para quem não é admin, igual a `products`. */
  adminProducts: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue>({
  products: [],
  adminProducts: [],
  loading: true,
  refresh: async () => {},
});

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdminAccount } = useUser();
  // Custos (só admin). Ficam só na memória: nunca entram no cache do catálogo
  // (IndexedDB), que é o mesmo para qualquer pessoa que use o aparelho.
  const [costs, setCosts] = useState<Map<string, number> | null>(null);
  // Ocultos (só admin): o catálogo público não os traz.
  const [hidden, setHidden] = useState<Product[]>([]);

  const reloadAdminData = useCallback(async () => {
    const [costsResult, hiddenResult] = await Promise.allSettled([
      loadProductCosts(),
      productService.getHidden(),
    ]);
    if (costsResult.status === 'fulfilled') setCosts(costsResult.value);
    else devWarn('ProductsContext: custos indisponíveis:', costsResult.reason);
    if (hiddenResult.status === 'fulfilled') setHidden(hiddenResult.value);
    else devWarn('ProductsContext: produtos ocultos indisponíveis:', hiddenResult.reason);
  }, []);

  useEffect(() => {
    if (isAdminAccount) reloadAdminData();
    else {
      setCosts(null);
      setHidden([]);
    }
  }, [isAdminAccount, reloadAdminData]);

  // refresh() sempre vai ao Firestore (ignora cache) — usado por botões manuais e após salvar
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [merged] = await Promise.all([
        productService.getMerged(true),
        isAdminAccount ? reloadAdminData() : Promise.resolve(),
      ]);
      setProducts(merged);
    } catch (e) {
      devWarn('ProductsContext refresh falhou:', e);
    } finally {
      setLoading(false);
    }
  }, [isAdminAccount, reloadAdminData]);

  const visibleProducts = useMemo(
    () => (isAdminAccount ? withCosts(products, costs) : products),
    [products, costs, isAdminAccount],
  );

  const adminProducts = useMemo(
    () => (isAdminAccount ? mergeAdminProducts(visibleProducts, hidden, costs) : visibleProducts),
    [visibleProducts, hidden, costs, isAdminAccount],
  );

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
          // Vazio na 1ª tentativa: tenta de novo rápido. Eram 3s fixos aqui, e
          // no iPhone essa espera era paga quase sempre — a leitura do Firestore
          // no WebKit costuma falhar na primeira tentativa, então o cliente
          // encarava 3s de tela vazia antes mesmo da segunda ida à rede.
          // Produto é leitura pública: não há auth a esperar.
          setTimeout(() => { if (!cancelled) load(1); }, 600);
        } else {
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        if (attempt === 0) {
          // Mesma razão do ramo acima: sem espera longa às cegas.
          setTimeout(() => { if (!cancelled) load(1); }, 600);
        } else {
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ProductsContext.Provider value={{ products: visibleProducts, adminProducts, loading, refresh }}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => useContext(ProductsContext);
