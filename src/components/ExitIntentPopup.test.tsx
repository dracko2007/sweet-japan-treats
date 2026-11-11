import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/types';
import { checkoutPointsCoverage, psFeeWaiver } from '@/utils/psFeeWaiver';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: '/checkout' },
  toast: vi.fn(),
  requestPsFeeWaiver: vi.fn(),
  localStock: undefined as undefined | Record<string, unknown>,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));
vi.mock('@/context/UserContext', () => ({
  useUser: () => ({ isAuthenticated: true }),
}));
vi.mock('@/context/CartContext', () => ({
  useCart: () => ({
    items: [{
      product: { id: 'produto-1', prices: { small: 1450 }, noPsFee: false, localStock: mocks.localStock },
      size: 'small',
      quantity: 1,
    } as unknown as CartItem],
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/newsletterService', () => ({
  newsletterService: { subscribe: vi.fn() },
}));
vi.mock('@/services/psFeeWaiverService', () => ({
  requestPsFeeWaiver: mocks.requestPsFeeWaiver,
}));

import ExitIntentPopup from './ExitIntentPopup';

function triggerDesktopExit() {
  act(() => { vi.advanceTimersByTime(6001); });
  fireEvent.mouseOut(document, { clientY: 0, relatedTarget: null });
}

describe('ExitIntentPopup com resgate de pontos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    localStorage.clear();
    sessionStorage.clear();
    mocks.localStock = undefined;
    mocks.requestPsFeeWaiver.mockReset().mockResolvedValue({
      token: 'autorizacao-assinada',
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('não oferece zerar a taxa PS quando cupom e pontos cobrem toda a mercadoria', () => {
    localStorage.setItem('redeem_points', '1000');
    checkoutPointsCoverage.set(true);
    render(<ExitIntentPopup />);

    triggerDesktopExit();

    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Finalize seu pedido');
    expect(screen.queryByText('Finalize agora e a taxa sai de graça!')).toBeNull();
  });

  it('mantém a oferta quando os pontos não cobrem toda a mercadoria', () => {
    localStorage.setItem('redeem_points', '1000');
    checkoutPointsCoverage.set(false);
    render(<ExitIntentPopup />);

    triggerDesktopExit();

    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Oferta: taxa de Personal Shopper grátis');
  });
  it('só ativa a isenção depois da autorização do servidor', async () => {
    render(<ExitIntentPopup />);
    triggerDesktopExit();
    fireEvent.click(screen.getByRole('button', { name: /Finalizar agora e economizar/i }));
    await act(async () => { await Promise.resolve(); });

    expect(mocks.requestPsFeeWaiver).toHaveBeenCalledTimes(1);
    expect(psFeeWaiver.token()).toBe('autorizacao-assinada');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pedido enviado do país do cliente: nenhum popup de saída (sem taxa PS nem isenção)', () => {
    localStorage.setItem('sakura_selected_country', 'Brasil');
    mocks.localStock = { Brasil: { enabled: true, price: 89, quantity: 5, shippingOptions: [{ name: 'Sul', price: 29 }] } };
    render(<ExitIntentPopup />);

    triggerDesktopExit();

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
