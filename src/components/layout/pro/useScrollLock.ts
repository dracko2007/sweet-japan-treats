import { useEffect } from 'react';
import { getLenis } from '@/lib/smoothScroll';

/**
 * Trava o scroll da página enquanto um overlay está aberto. O Lenis ignora
 * `overflow: hidden` no body (ele mesmo move a janela), então também é pausado.
 * Containers roláveis dentro do overlay precisam de `data-lenis-prevent`.
 */
export const useScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    const lenis = getLenis();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lenis?.stop();
    return () => {
      document.body.style.overflow = prev;
      lenis?.start();
    };
  }, [active]);
};

/** Fecha com Escape enquanto `active`. */
export const useEscape = (active: boolean, onEscape: () => void) => {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
};
