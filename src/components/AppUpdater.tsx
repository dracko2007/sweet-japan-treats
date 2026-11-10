import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { aoFicarPronta, atualizacaoPronta, podeAplicarAoNavegar } from '@/utils/appUpdate';

/**
 * Versão nova do app: entra sozinha na primeira troca de página e, enquanto
 * isso, um aviso deixa o cliente atualizar na hora com um toque. Sem o aviso,
 * quem ficava na mesma tela (ou só reabria o app no iPhone, que retoma de onde
 * parou) continuava vendo a versão antiga e achava que precisava reinstalar.
 */
const AppUpdater = () => {
  const { pathname } = useLocation();
  const anterior = useRef(pathname);
  const pronta = useSyncExternalStore(aoFicarPronta, atualizacaoPronta, () => false);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = pathname;
    if (atualizacaoPronta() && podeAplicarAoNavegar(de, pathname)) {
      // A URL já é a da página nova: recarregar abre ela com a versão nova.
      window.location.reload();
    }
  }, [pathname]);

  // Ao voltar para o app (reabrir o PWA), pergunta ao servidor se saiu versão nova.
  useEffect(() => {
    const conferir = () => {
      if (document.visibilityState !== 'visible' || !('serviceWorker' in navigator)) return;
      navigator.serviceWorker.getRegistration().then((registro) => registro?.update()).catch(() => {});
    };
    document.addEventListener('visibilitychange', conferir);
    return () => document.removeEventListener('visibilitychange', conferir);
  }, []);

  // Telas de pagamento/cadastro: não oferece recarregar no meio do formulário.
  if (!pronta || !podeAplicarAoNavegar('/', pathname === '/' ? '/produtos' : pathname)) return null;

  return (
    <button
      type="button"
      // O toque é o gesto do usuário: recarregar aqui não cai no bug de tela branca do iOS.
      onClick={() => window.location.reload()}
      className="fixed left-1/2 top-3 z-[10003] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-xl"
    >
      <RefreshCw className="h-4 w-4" aria-hidden />
      Nova versão disponível — toque para atualizar
    </button>
  );
};

export default AppUpdater;
