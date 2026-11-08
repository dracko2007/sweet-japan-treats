import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { atualizacaoPronta, podeAplicarAoNavegar } from '@/utils/appUpdate';

/** Aplica a versão nova do app na primeira troca de página depois que ela chega. */
const AppUpdater = () => {
  const { pathname } = useLocation();
  const anterior = useRef(pathname);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = pathname;
    if (atualizacaoPronta() && podeAplicarAoNavegar(de, pathname)) {
      // A URL já é a da página nova: recarregar abre ela com a versão nova.
      window.location.reload();
    }
  }, [pathname]);

  return null;
};

export default AppUpdater;
