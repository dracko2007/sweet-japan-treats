// Balões flutuantes (assistente e WhatsApp) que o cliente pode minimizar.
// Minimizado, o balão sai do canto da tela e vira um ícone pequeno no topo.
// A escolha fica salva no aparelho (conveniência de quem está vendo).
import { useSyncExternalStore } from 'react';
import { safeStorage } from '@/utils/storage';

export type FloatingWidget = 'assistant' | 'whatsapp';

const KEY = 'je_floating_minimized';
const OPEN_EVENT = 'je:floating-open';

function ler(): Record<FloatingWidget, boolean> {
  try {
    const raw = JSON.parse(safeStorage.getItem(KEY) || '{}') as Partial<Record<FloatingWidget, unknown>>;
    return { assistant: raw.assistant === true, whatsapp: raw.whatsapp === true };
  } catch {
    return { assistant: false, whatsapp: false };
  }
}

let estado = ler();
const ouvintes = new Set<() => void>();

function gravar(proximo: Record<FloatingWidget, boolean>): void {
  estado = proximo;
  safeStorage.setItem(KEY, JSON.stringify(proximo));
  ouvintes.forEach((ouvir) => ouvir());
}

export function setMinimized(widget: FloatingWidget, minimized: boolean): void {
  if (estado[widget] === minimized) return;
  gravar({ ...estado, [widget]: minimized });
}

export function isMinimized(widget: FloatingWidget): boolean {
  return estado[widget];
}

/** Volta o balão para o canto e pede para ele abrir o atendimento. */
export function restoreAndOpen(widget: FloatingWidget): void {
  setMinimized(widget, false);
  window.dispatchEvent(new CustomEvent<FloatingWidget>(OPEN_EVENT, { detail: widget }));
}

/** Chama `abrir` quando o ícone do topo pede para abrir este balão. */
export function onOpenRequest(widget: FloatingWidget, abrir: () => void): () => void {
  const ouvir = (event: Event) => {
    if ((event as CustomEvent<FloatingWidget>).detail === widget) abrir();
  };
  window.addEventListener(OPEN_EVENT, ouvir);
  return () => window.removeEventListener(OPEN_EVENT, ouvir);
}

function assinar(ouvir: () => void): () => void {
  ouvintes.add(ouvir);
  return () => ouvintes.delete(ouvir);
}

export function useMinimized(widget: FloatingWidget): boolean {
  return useSyncExternalStore(assinar, () => estado[widget], () => false);
}
