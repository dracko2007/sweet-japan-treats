import { describe, expect, it } from 'vitest';
import { podeAplicarAoNavegar } from './appUpdate';

describe('podeAplicarAoNavegar', () => {
  it('aplica ao trocar de página na loja', () => {
    expect(podeAplicarAoNavegar('/', '/produtos')).toBe(true);
    expect(podeAplicarAoNavegar('/produtos', '/produto/fino')).toBe(true);
  });

  it('não recarrega no checkout, no login nem ao entrar/sair deles', () => {
    expect(podeAplicarAoNavegar('/carrinho', '/checkout')).toBe(false);
    expect(podeAplicarAoNavegar('/checkout', '/order-review')).toBe(false);
    expect(podeAplicarAoNavegar('/order-review', '/order-confirmation')).toBe(false);
    expect(podeAplicarAoNavegar('/login', '/')).toBe(false);
    expect(podeAplicarAoNavegar('/', '/cadastro')).toBe(false);
  });

  it('mesma página não conta', () => {
    expect(podeAplicarAoNavegar('/produtos', '/produtos')).toBe(false);
  });
});
