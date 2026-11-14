import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { safeStorage } from '@/utils/storage';
import { getLenis } from '@/lib/smoothScroll';
import { affiliateService } from '@/services/affiliateService';

// Extrai o productId de rotas como /produto/:id ou /produto/:id?ref=CODE
const extractProductId = (pathname: string): string | null => {
  const match = pathname.match(/^\/produto\/([^/?#]+)/);
  return match ? match[1] : null;
};

// Sobe por todos os caminhos: o Lenis (posição interna), a janela e os elementos
// raiz. No PWA instalado (standalone) o navegador não restaura nem zera o scroll
// como numa aba comum, e a rota nova pode montar depois (lazy), então um único
// `scrollTo` no instante da troca era desfeito e a página abria na posição antiga.
function scrollToTopNow() {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

const ScrollToTop = () => {
  const { pathname, search } = useLocation();
  const firstLoadRef = useRef(true);

  // Clicar num link interno que leva à MESMA página (logo na home, menu da página
  // atual, mudança só de filtro na URL) não troca o `pathname`, então o efeito
  // abaixo não rodava e a página ficava onde estava. Todo clique em link interno
  // sobe ao topo. Ficam de fora: nova aba, download, modificadores e âncoras (#).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(link.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || url.hash) return;
      requestAnimationFrame(scrollToTopNow);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    // Nada de restaurar posição antiga ao navegar: a loja sempre abre a página no topo.
    try { window.history.scrollRestoration = 'manual'; } catch { /* navegador sem suporte */ }
    // Repete algumas vezes porque a rota nova (carregada sob demanda) cresce depois do
    // primeiro frame e o Lenis/navegador podem reaplicar a posição anterior nesse meio-tempo.
    scrollToTopNow();
    const frame = requestAnimationFrame(scrollToTopNow);
    const timers = [80, 250].map((ms) => window.setTimeout(scrollToTopNow, ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  // A referência capturada é válida apenas para a navegação iniciada pelo link.
  // Não reutiliza código antigo ao abrir diretamente a loja ou após refresh.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ref = params.get('ref');
    if (ref) {
      safeStorage.setItem('affiliate_ref', ref.trim().toUpperCase());
      // Conta a chegada pelo link (retorno do divulgador/afiliado); uma vez por pessoa.
      void affiliateService.trackVisit(ref, 'link');
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
