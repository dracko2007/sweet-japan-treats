import { describe, expect, it } from 'vitest';
import { clampOffset } from './useDraggableBubble';

const tela = { width: 390, height: 844 };
// Balão de 56px no canto inferior direito (posição padrão, sem deslocamento).
const box = { left: 310, top: 700, width: 56, height: 56 };

describe('clampOffset — balão nunca sai da tela', () => {
  it('aceita um arrasto dentro da tela', () => {
    expect(clampOffset({ x: -100, y: -300 }, { x: 0, y: 0 }, box, tela)).toEqual({ x: -100, y: -300 });
  });

  it('segura nas bordas com margem de 8px', () => {
    // Para a esquerda demais: left final = 8.
    expect(clampOffset({ x: -1000, y: 0 }, { x: 0, y: 0 }, box, tela).x).toBe(8 - 310);
    // Para baixo demais: top final = 844 - 8 - 56.
    expect(clampOffset({ x: 0, y: 500 }, { x: 0, y: 0 }, box, tela).y).toBe(844 - 8 - 56 - 700);
    // Para cima demais: top final = 8.
    expect(clampOffset({ x: 0, y: -2000 }, { x: 0, y: 0 }, box, tela).y).toBe(8 - 700);
  });

  it('considera o deslocamento que já está aplicado', () => {
    // Caixa já movida 100px para a esquerda: a base continua sendo left 310.
    const movida = { ...box, left: 210 };
    expect(clampOffset({ x: 1000, y: 0 }, { x: -100, y: 0 }, movida, tela).x).toBe(390 - 8 - 56 - 310);
  });
});
