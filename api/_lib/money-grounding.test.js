import { describe, expect, it } from 'vitest';
import { containsUngroundedMoney, ungroundedMoney } from './money-grounding.js';

const grounding = JSON.stringify({ frete: 'R$ 189 (¥ 5.100)', preco_venda: '¥ 2.400', lucro: '¥ 1.200' });

describe('money grounding', () => {
  it('aceita valor das ferramentas no fim da frase ou antes de vírgula', () => {
    expect(containsUngroundedMoney('O frete fica R$ 189.', grounding)).toBe(false);
    expect(containsUngroundedMoney('Bioré: vendido a ¥2.400, lucro ¥1.200.', grounding)).toBe(false);
    expect(containsUngroundedMoney('Lucro de ¥ 1.200, margem 50%', grounding)).toBe(false);
    expect(containsUngroundedMoney('Frete R$ 189 (¥ 5.100)', grounding)).toBe(false);
  });

  it('continua barrando valor inventado', () => {
    expect(ungroundedMoney('O frete fica R$ 150.', grounding)).toEqual(['R$ 150.']);
    expect(containsUngroundedMoney('Lucro ¥ 1.250, ótimo', grounding)).toBe(true);
    expect(containsUngroundedMoney('Total ¥2.400.500', grounding)).toBe(true);
  });

  it('sem valores em dinheiro não barra nada', () => {
    expect(containsUngroundedMoney('A margem é 50%.', grounding)).toBe(false);
    expect(containsUngroundedMoney('', grounding)).toBe(false);
  });
});
