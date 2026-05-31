import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { safeStorage } from '@/utils/storage';

const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Captura o código de indicação do link (?ref=CODE) e guarda para o checkout
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ref = params.get('ref');
    if (ref) {
      safeStorage.setItem('affiliate_ref', ref.trim().toUpperCase());
    }
  }, [search]);

  return null;
};

export default ScrollToTop;
