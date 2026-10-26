import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
} from 'framer-motion';

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/** true só em aparelho com mouse (computador). Celular/tablet ficam sem tilt. */
export const useFinePointer = (): boolean => {
  const [fine, setFine] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(FINE_POINTER).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(FINE_POINTER);
    const onChange = () => setFine(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return fine;
};

interface TiltOptions {
  /** Inclinação máxima em graus. */
  max?: number;
  /** Escala ao passar o mouse. */
  lift?: number;
  /** Deslocamento máximo (px) da camada interna — dá a sensação de profundidade. */
  parallax?: number;
}

/**
 * Inclinação 3D que segue o mouse, com brilho de vidro e parallax de uma
 * camada interna. Tudo em motion values (sem re-render por movimento).
 * Desligado no toque e com `prefers-reduced-motion` — aí os estilos voltam vazios.
 */
export function useTilt({ max = 9, lift = 1.035, parallax = 8 }: TiltOptions = {}) {
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const enabled = fine && !reduce;

  const px = useMotionValue(0); // -0.5 … 0.5
  const py = useMotionValue(0);
  const active = useMotionValue(0); // 0 fora, 1 com mouse em cima

  const spring = { stiffness: 260, damping: 22, mass: 0.6 };
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);
  const sa = useSpring(active, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const scale = useTransform(sa, [0, 1], [1, lift]);
  const glareX = useTransform(sx, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(sy, [-0.5, 0.5], ['0%', '100%']);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 28%, transparent 60%)`;
  const innerX = useTransform(sx, [-0.5, 0.5], [-parallax, parallax]);
  const innerY = useTransform(sy, [-0.5, 0.5], [-parallax, parallax]);

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
    active.set(1);
  };

  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
    active.set(0);
  };

  const cardStyle: MotionStyle = enabled
    ? { rotateX, rotateY, scale, transformPerspective: 900 }
    : {};
  const glareStyle: MotionStyle = enabled ? { background: glare, opacity: sa } : { display: 'none' };
  const innerStyle: MotionStyle = enabled ? { x: innerX, y: innerY } : {};

  return {
    enabled,
    handlers: { onPointerMove, onPointerLeave },
    cardStyle,
    glareStyle,
    innerStyle,
  };
}
