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

describe('Sandbox — afiliado (painel)', () => {
  // Carrinho padrão: ¥2.000 (promoção, sem cupom) + ¥3.000 (cupom de 10% = ¥300); custo de 50%.
  // Venda líquida ¥4.700, custo ¥2.500, lucro ¥2.200; Bronze 10% => comissão ¥220, lucro final ¥1.980.
  it('mostra a conta passo a passo antes e acumula desconto, custo, comissão e lucro final', () => {
    render(<CheckoutSandbox />);
    expect(screen.getByText('Compra 1: a conta passo a passo')).toBeInTheDocument();
    expect(screen.getAllByText('−¥300').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Simular compra'));
    expect(screen.getByRole('status')).toHaveTextContent('comissão: ¥220');
    const kpi = (label: string) => screen.getAllByText(label)[0].closest('div')!.parentElement!;
    expect(kpi('Vendas de produtos (líquidas)')).toHaveTextContent('¥4,700');
    expect(kpi('Desconto dado ao cliente')).toHaveTextContent('−¥300');
    expect(kpi('Custo dos produtos')).toHaveTextContent('¥2,500');
    expect(kpi('Lucro bruto (conta da meta)')).toHaveTextContent('¥2,200');
    expect(kpi('A PAGAR ao afiliado')).toHaveTextContent('¥220');
    expect(kpi('Seu lucro depois da comissão')).toHaveTextContent('¥1,980');
    expect(screen.getByText('Compras simuladas no mês')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fechar mês / zerar'));
    expect(kpi('A PAGAR ao afiliado')).toHaveTextContent('¥0');
    expect(screen.queryByText('Compras simuladas no mês')).not.toBeInTheDocument();
  });
});
