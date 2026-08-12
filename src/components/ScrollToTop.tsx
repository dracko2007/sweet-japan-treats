import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { safeStorage } from '@/utils/storage';

// Extrai o productId de rotas como /produto/:id ou /produto/:id?ref=CODE
const extractProductId = (pathname: string): string | null => {
  const match = pathname.match(/^\/produto\/([^/?#]+)/);
  return match ? match[1] : null;
};

const ScrollToTop = () => {
  const { pathname, search } = useLocation();
  const firstLoadRef = useRef(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // A referência capturada é válida apenas para a navegação iniciada pelo link.
  // Não reutiliza código antigo ao abrir diretamente a loja ou após refresh.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ref = params.get('ref');
    if (ref) {
      safeStorage.setItem('affiliate_ref', ref.trim().toUpperCase());
      const productId = extractProductId(pathname);
      if (productId) {
        safeStorage.setItem('affiliate_ref_product', productId);
      } else {
        safeStorage.removeItem('affiliate_ref_product');
      }
    } else if (firstLoadRef.current) {
      safeStorage.removeItem('affiliate_ref');
      safeStorage.removeItem('affiliate_ref_product');
    }
    firstLoadRef.current = false;

    const promo = params.get('promo');
    if (promo) {
      safeStorage.setItem('pending_promo', promo.trim().toUpperCase());
    }
  }, [search, pathname]);

  return null;
};

export default ScrollToTop;
