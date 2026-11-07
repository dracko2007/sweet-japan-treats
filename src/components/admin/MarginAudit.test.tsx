import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Product } from '@/types';

const product = (id: string, name: string, cost: number | undefined, extra: Partial<Product> = {}) =>
  ({ id, name, category: 'cosmeticos', prices: { small: 2000, large: 2000 }, image: '', cost, ...extra }) as unknown as Product;

vi.mock('@/context/ProductsContext', () => ({
  useProducts: () => ({
    adminProducts: [
      product('a', 'Margem Baixa', 1500),
      product('b', 'Margem Boa', 500),
      product('c', 'Zeta Sem Custo', undefined),
      product('d', 'Alfa Sem Custo', 0, { hidden: true }),
    ],
  }),
}));

const { default: MarginAudit } = await import('./MarginAudit');

describe('MarginAudit', () => {
  it('abre nos produtos abaixo de 50%', () => {
    render(<MarginAudit />);
    expect(screen.getByText('Margem Baixa')).toBeTruthy();
    expect(screen.queryByText('Zeta Sem Custo')).toBeNull();
  });

  it('o botão "Sem custo" lista só os sem custo, em ordem alfabética, marcando os ocultos', () => {
    render(<MarginAudit />);
    fireEvent.click(screen.getByRole('button', { name: /Sem custo \(2\)/ }));
    const names = screen.getAllByText(/Sem Custo/).map((el) => el.textContent?.replace('oculto', '').trim());
    expect(names).toEqual(['Alfa Sem Custo', 'Zeta Sem Custo']);
    expect(screen.queryByText('Margem Baixa')).toBeNull();
    expect(screen.getByText('oculto')).toBeTruthy();
  });

  it('o cartão "Sem custo cadastrado" também filtra', () => {
    render(<MarginAudit />);
    fireEvent.click(screen.getByText('Sem custo cadastrado'));
    expect(screen.getByText('Zeta Sem Custo')).toBeTruthy();
    expect(screen.queryByText('Margem Boa')).toBeNull();
  });
});
