import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CheckoutSandbox from './CheckoutSandbox';

describe('Sandbox — divulgador', () => {
  it('conta visita uma vez por pessoa, bloqueia reuso do código e libera com código novo', () => {
    render(<CheckoutSandbox />);
    fireEvent.click(screen.getByText('Divulgador'));
    expect(screen.getByDisplayValue('DIVULGADOR1FINO')).toBeInTheDocument();
    expect(screen.getByText(/ref=DIVULGADOR1FINO/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cliente A abre o link'));
    expect(screen.getByRole('status')).toHaveTextContent('VISITA CONTADA');
    fireEvent.click(screen.getByText('Cliente A digita o código'));
    expect(screen.getByRole('status')).toHaveTextContent('NÃO CONTA');

    fireEvent.click(screen.getByText('Simular compra de Cliente A'));
    expect(screen.getByRole('status')).toHaveTextContent('SEM comissão');
    fireEvent.click(screen.getByText('Simular compra de Cliente A'));
    expect(screen.getByRole('status')).toHaveTextContent('BLOQUEADO');

    // outro cadastro compra normalmente
    fireEvent.click(screen.getByText('Cliente B'));
    fireEvent.click(screen.getByText('Simular compra de Cliente B'));
    expect(screen.getByRole('status')).toHaveTextContent('COMPRA SIMULADA');

    // código novo (outro vídeo) libera o Cliente A de novo
    fireEvent.change(screen.getByDisplayValue('DIVULGADOR1FINO'), { target: { value: 'divulgador1outro' } });
    fireEvent.click(screen.getByText('Cliente A'));
    fireEvent.click(screen.getByText('Simular compra de Cliente A'));
    expect(screen.getByRole('status')).toHaveTextContent('COMPRA SIMULADA');
  });
});
