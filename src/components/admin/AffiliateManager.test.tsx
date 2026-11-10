import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const save = vi.fn().mockResolvedValue(true);
const toast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }));
vi.mock('@/context/ProductsContext', () => ({
  useProducts: () => ({ products: [{ id: 'fino-mask', name: 'Fino Hair Mask' }] }),
}));
vi.mock('@/services/affiliateService', () => ({
  affiliateLink: (code: string, productId?: string) =>
    productId ? `https://japanexpress-store.com/produto/${productId}?ref=${code}` : `https://japanexpress-store.com/?ref=${code}`,
  isPromoter: (affiliate: { kind?: string }) => affiliate.kind === 'promoter',
  TIER_CONFIG: {
    bronze: { label: 'Bronze', emoji: '🥉', commissionPercent: 10, goalYen: 100000 },
  },
  affiliateService: {
    getAll: vi.fn().mockResolvedValue([
      {
        code: 'JUNIOR10', ownerName: 'Junior', ownerEmail: 'junior@x.com', discountPercent: 10,
        commissionPercent: 10, active: true, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        createdAt: '2026-01-01', totalOrders: 0, totalRevenue: 0, totalEarnings: 0, tier: 'bronze',
        currentMonthRevenue: 0, currentMonthKey: '2026-11',
      },
    ]),
    getPendingCommissions: vi.fn().mockResolvedValue([]),
    save: (...args: unknown[]) => save(...args),
  },
}));

const { default: AffiliateManager } = await import('./AffiliateManager');

describe('AffiliateManager', () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    save.mockClear();
    toast.mockClear();
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it('Editar abre o formulário com os dados e rola até ele', async () => {
    render(<AffiliateManager />);
    fireEvent.click(await screen.findByTitle('Editar afiliado'));
    expect(screen.getByText('Editar afiliado JUNIOR10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('junior@x.com')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('+ Código abre o formulário vazio para o mesmo influencer e salva o novo código', async () => {
    render(<AffiliateManager />);
    fireEvent.click(await screen.findByTitle('Adicionar outro código'));
    expect(screen.getByText('Novo código para Junior')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Ex: JUNIOR10'), { target: { value: 'junior20' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ code: 'JUNIOR20', ownerEmail: 'junior@x.com' })));
  });

  it('não deixa criar um código que já existe', async () => {
    render(<AffiliateManager />);
    fireEvent.click(await screen.findByTitle('Adicionar outro código'));
    fireEvent.change(screen.getByPlaceholderText('Ex: JUNIOR10'), { target: { value: 'junior10' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(save).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'O código JUNIOR10 já existe' }));
  });

  it('Novo Afiliado depois de editar abre o formulário limpo', async () => {
    render(<AffiliateManager />);
    fireEvent.click(await screen.findByTitle('Editar afiliado'));
    fireEvent.click(screen.getByText('Cancelar'));
    fireEvent.click(screen.getByText('Novo Afiliado'));
    expect(screen.getByText('Cadastrar Influencer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: JUNIOR10')).toHaveValue('');
    expect(screen.getByPlaceholderText('influencer@email.com')).toHaveValue('');
  });

  it('Divulgador exige o produto e salva sem comissão, com o link do produto', async () => {
    render(<AffiliateManager />);
    fireEvent.click(await screen.findByText('Novo Afiliado'));
    fireEvent.change(screen.getByLabelText('Tipo de parceria *'), { target: { value: 'promoter' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: DIVULGADOR1FINO'), { target: { value: 'divulgador1fino' } });
    fireEvent.change(screen.getByPlaceholderText('influencer@email.com'), { target: { value: 'div@x.com' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(save).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Escolha o produto enviado ao divulgador' }));

    fireEvent.change(screen.getByLabelText('Produto enviado *'), { target: { value: 'fino-mask' } });
    expect(screen.getByText('https://japanexpress-store.com/produto/fino-mask?ref=DIVULGADOR1FINO')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      code: 'DIVULGADOR1FINO', kind: 'promoter', productId: 'fino-mask', productName: 'Fino Hair Mask',
      commissionPercent: 0, discountPercent: 0,
    })));
    expect(save.mock.calls[0][0]).not.toHaveProperty('tierSettings');
  });
});
