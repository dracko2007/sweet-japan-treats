import { describe, expect, it, vi } from 'vitest';
import { isMinimized, onOpenRequest, restoreAndOpen, setMinimized } from './floatingWidgets';

describe('balões flutuantes minimizáveis', () => {
  it('minimiza e salva no aparelho', () => {
    setMinimized('whatsapp', true);
    expect(isMinimized('whatsapp')).toBe(true);
    expect(isMinimized('assistant')).toBe(false);
    expect(JSON.parse(localStorage.getItem('je_floating_minimized') || '{}').whatsapp).toBe(true);
  });

  it('o ícone do topo restaura e abre só o balão pedido', () => {
    setMinimized('assistant', true);
    const abrirAssistente = vi.fn();
    const abrirWhats = vi.fn();
    const off1 = onOpenRequest('assistant', abrirAssistente);
    const off2 = onOpenRequest('whatsapp', abrirWhats);
    restoreAndOpen('assistant');
    expect(isMinimized('assistant')).toBe(false);
    expect(abrirAssistente).toHaveBeenCalledTimes(1);
    expect(abrirWhats).not.toHaveBeenCalled();
    off1();
    off2();
  });
});
