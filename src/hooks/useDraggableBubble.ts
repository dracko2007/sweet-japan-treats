// Arrastar um balão flutuante (WhatsApp / assistente) pela tela.
// Toque curto continua sendo clique; só vira arrasto depois de DRAG_START_PX.
// A posição (deslocamento a partir do canto padrão) fica salva no aparelho.
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { safeStorage } from '@/utils/storage';
import type { FloatingWidget } from '@/utils/floatingWidgets';

export interface Offset { x: number; y: number }
export interface Box { left: number; top: number; width: number; height: number }

const KEY = 'je_floating_pos';
const DRAG_START_PX = 6;
const MARGIN = 8;

function lerTodos(): Partial<Record<FloatingWidget, Offset>> {
  try {
    return JSON.parse(safeStorage.getItem(KEY) || '{}') as Partial<Record<FloatingWidget, Offset>>;
  } catch {
    return {};
  }
}

function lerOffset(widget: FloatingWidget): Offset {
  const o = lerTodos()[widget];
  return o && Number.isFinite(o.x) && Number.isFinite(o.y) ? { x: o.x, y: o.y } : { x: 0, y: 0 };
}

function gravarOffset(widget: FloatingWidget, offset: Offset): void {
  safeStorage.setItem(KEY, JSON.stringify({ ...lerTodos(), [widget]: offset }));
}

/**
 * Deslocamento que mantém a caixa inteira dentro da tela.
 * `box` é a posição da caixa com o deslocamento `atual` já aplicado.
 */
export function clampOffset(desejado: Offset, atual: Offset, box: Box, tela: { width: number; height: number }): Offset {
  // Posição da caixa sem deslocamento nenhum (o canto padrão).
  const baseLeft = box.left - atual.x;
  const baseTop = box.top - atual.y;
  const minX = MARGIN - baseLeft;
  const maxX = tela.width - MARGIN - box.width - baseLeft;
  const minY = MARGIN - baseTop;
  const maxY = tela.height - MARGIN - box.height - baseTop;
  return {
    x: Math.round(Math.min(Math.max(desejado.x, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(desejado.y, minY), Math.max(minY, maxY))),
  };
}

/** `ativo` = balão fechado (só ele aparece). Aberto, o painel volta ao canto. */
export function useDraggableBubble(widget: FloatingWidget, ativo = true) {
  const [offset, setOffset] = useState<Offset>(() => lerOffset(widget));
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; from: Offset; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const clampToScreen = useCallback((desejado: Offset): Offset => {
    const el = containerRef.current;
    if (!el) return desejado;
    const r = el.getBoundingClientRect();
    return clampOffset(desejado, offsetRef.current, { left: r.left, top: r.top, width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight });
  }, []);

  // Tela girou / mudou de tamanho: puxa o balão de volta para dentro.
  // Com o painel aberto não: o teclado do celular também dispara resize, e a
  // caixa medida seria a do painel, não a do balão.
  useEffect(() => {
    if (!ativo) return;
    const onResize = () => setOffset((o) => clampToScreen(o));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampToScreen, ativo]);

  // Os movimentos são escutados na janela inteira: num gesto rápido o dedo
  // sai de cima do balão antes do primeiro "pointermove".
  const pararRef = useRef<(() => void) | null>(null);
  useEffect(() => () => pararRef.current?.(), []);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pararRef.current?.();
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, from: offsetRef.current, moved: false };
    let ultimo = offsetRef.current;

    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== ev.pointerId) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < DRAG_START_PX) return;
        d.moved = true;
      }
      ultimo = clampToScreen({ x: d.from.x + dx, y: d.from.y + dy });
      setOffset(ultimo);
    };
    const onEnd = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== ev.pointerId) return;
      parar();
      drag.current = null;
      if (d.moved) {
        justDragged.current = true; // o clique que vem logo depois não abre o balão
        // Se nenhum clique vier (soltou fora do balão), libera o próximo toque.
        window.setTimeout(() => { justDragged.current = false; }, 400);
        gravarOffset(widget, ultimo);
      }
    };
    const parar = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      pararRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    pararRef.current = parar;
  };

  /** No container: engole o clique que encerra um arrasto. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!justDragged.current) return;
    justDragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    containerRef,
    offset,
    onClickCapture,
    /** Espalhar no botão principal do balão (a "alça" do arrasto). */
    handleProps: {
      onPointerDown,
      style: { touchAction: 'none' as const },
    },
  };
}
