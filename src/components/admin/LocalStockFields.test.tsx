import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LocalStock } from '@/types';
import { LocalStockFields } from './LocalStockFields';

let latest: LocalStock | undefined;
const Host: React.FC<{ initial: LocalStock }> = ({ initial }) => {
  const [value, setValue] = useState<LocalStock | undefined>(initial);
  latest = value;
  return <LocalStockFields value={value} onChange={setValue} />;
};

describe('frete nacional no cadastro do produto', () => {
  afterEach(() => { cleanup(); latest = undefined; });

  it('o botão + adiciona uma linha de nome e valor; "As 5 regiões" preenche os nomes', () => {
    render(<Host initial={{ Brasil: { enabled: true, price: 89, quantity: 3 } }} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar frete/i }));
    fireEvent.change(screen.getByLabelText('Nome do frete 1 no Brasil'), { target: { value: 'Sul' } });
    fireEvent.change(screen.getByLabelText('Valor do frete 1 no Brasil'), { target: { value: '29' } });
    expect(latest?.Brasil.shippingOptions).toEqual([{ name: 'Sul', price: 29 }]);

    fireEvent.click(screen.getByRole('button', { name: /Adicionar frete/i }));
    expect(latest?.Brasil.shippingOptions).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover frete' })[1]);
    expect(latest?.Brasil.shippingOptions).toEqual([{ name: 'Sul', price: 29 }]);
  });

  it('cadastro antigo com frete único aparece como uma linha e migra ao editar', () => {
    render(<Host initial={{ Brasil: { enabled: true, price: 89, quantity: 3, shipping: 25 } }} />);
    expect((screen.getByLabelText('Valor do frete 1 no Brasil') as HTMLInputElement).value).toBe('25');
    fireEvent.change(screen.getByLabelText('Nome do frete 1 no Brasil'), { target: { value: 'Todo o Brasil' } });
    expect(latest?.Brasil.shippingOptions).toEqual([{ name: 'Todo o Brasil', price: 25 }]);
    expect(latest?.Brasil.shipping).toBeNull();
  });
});
