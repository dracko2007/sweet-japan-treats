import { describe, expect, it, vi } from 'vitest';
import { isMinimized, onOpenRequest, restoreAndOpen, setMinimized } from './floatingWidgets';

describe('balões flutuantes minimizáveis', () => {
  it('começam minimizados; abrir e minimizar ficam salvos no aparelho', () => {
    expect(isMinimized('whatsapp')).toBe(true);
    expect(isMinimized('assistant')).toBe(true);
    setMinimized('whatsapp', false);
    expect(isMinimized('whatsapp')).toBe(false);
    expect(JSON.parse(localStorage.getItem('je_floating_minimized_v2') || '{}').whatsapp).toBe(false);
    setMinimized('whatsapp', true);
    expect(JSON.parse(localStorage.getItem('je_floating_minimized_v2') || '{}').whatsapp).toBe(true);
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
