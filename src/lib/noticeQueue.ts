import { useEffect, useSyncExternalStore } from 'react';

/**
 * Fila de avisos: no máximo UM aviso flutuante (cookies, instalar app,
 * carrinho abandonado...) na tela por vez. Antes eles podiam aparecer juntos
 * e disputar a parte de baixo da tela do celular.
 *
 * - Quem tem maior prioridade entra primeiro; quem já está na tela não é
 *   trocado por um de prioridade maior que chegou depois (evita "pisca").
 * - Entre um aviso e o próximo há um respiro de GAP_MS.
 * - `preempt` (popup de saída) entra na hora e esconde o atual; ao fechar,
 *   o anterior volta.
 */

interface Entry {
  id: string;
  priority: number;
  preempt: boolean;
}

export const NOTICE_GAP_MS = 4000;

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let active: string | null = null;
let lastReleaseAt = 0;
let gapTimer: ReturnType<typeof setTimeout> | undefined;

const emit = () => listeners.forEach((l) => l());

const byPriority = (a: Entry, b: Entry) => b.priority - a.priority;

function pick() {
  clearTimeout(gapTimer);
  const prev = active;

  const preempting = [...entries.values()].filter((e) => e.preempt).sort(byPriority)[0];
  if (preempting) {
    active = preempting.id;
  } else if (active && entries.has(active) && !entries.get(active)?.preempt) {
    // O atual continua.
  } else {
    if (active) lastReleaseAt = Date.now();
    active = null;
    const wait = lastReleaseAt + NOTICE_GAP_MS - Date.now();
    if (lastReleaseAt && wait > 0) {
      gapTimer = setTimeout(pick, wait);
    } else {
      active = [...entries.values()].sort(byPriority)[0]?.id ?? null;
    }
  }

  if (prev !== active) emit();
}

export const noticeQueue = {
  request(id: string, priority: number, preempt = false) {
    entries.set(id, { id, priority, preempt });
    pick();
  },
  release(id: string) {
    if (!entries.delete(id)) return;
    if (active === id) {
      active = null;
      lastReleaseAt = Date.now();
      emit();
    }
    pick();
  },
  isActive: (id: string) => active === id,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Só para testes. */
  reset() {
    entries.clear();
    active = null;
    lastReleaseAt = 0;
    clearTimeout(gapTimer);
    emit();
  },
};

interface SlotOptions {
  priority?: number;
  preempt?: boolean;
}

/**
 * Pede um lugar na fila enquanto `wants` for true. Retorna se o aviso pode
 * aparecer agora.
 */
export function useNoticeSlot(id: string, wants: boolean, { priority = 0, preempt = false }: SlotOptions = {}): boolean {
  useEffect(() => {
    if (!wants) {
      noticeQueue.release(id);
      return;
    }
    noticeQueue.request(id, priority, preempt);
    return () => noticeQueue.release(id);
  }, [id, wants, priority, preempt]);

  return useSyncExternalStore(
    noticeQueue.subscribe,
    () => noticeQueue.isActive(id),
    () => false,
  );
}
