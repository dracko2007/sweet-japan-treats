// Logout e troca de usuário apagam do navegador tudo que é da conta. Ficam só
// as preferências do aparelho e o estado interno do Firebase Auth (as fotos e o
// catálogo vivem fora do localStorage). Antes, só 4 chaves saíam: favoritos,
// pedidos, cupons, chat e o cadastro local de OUTROS usuários ficavam para o
// próximo que usasse o computador.
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL } from '@/config/admin';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  // Auth ainda resolvendo: a sessão gravada fica de pé até o teste agir.
  onAuthChange: vi.fn(() => () => undefined),
}));

vi.mock('@/config/firebase', () => ({
  app: null,
  auth: { currentUser: null },
  db: null,
  storage: null,
  firebaseConfigReady: true,
  allowLocalOnly: false,
  firebaseDisabled: false,
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
}));
vi.mock('@/services/adminService', () => ({
  adminService: { authenticate: mocks.authenticate, getAdmins: vi.fn(), isSuper: () => true },
}));
vi.mock('@/services/firebaseSyncService', () => ({
  firebaseSyncService: {
    onAuthChange: mocks.onAuthChange,
    getUserFromFirestore: vi.fn(),
    logoutUser: vi.fn(),
    loginUser: vi.fn(),
    getOrdersPageFromFirestore: vi.fn(),
    resendVerificationEmail: vi.fn(),
    syncUserToFirestore: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock('@/services/referralService', () => ({
  referralService: { captureReferral: vi.fn(), getPendingReferral: vi.fn(() => null), clearPendingReferral: vi.fn() },
}));
vi.mock('@/lib/analytics', () => ({ trackLogin: vi.fn(), trackSignUp: vi.fn() }));
vi.mock('@/services/mailService', () => ({ sendVerificationEmail: vi.fn() }));

import { UserProvider, useUser, type UserContextType } from './UserContext';

let contexto: UserContextType;
function Probe() {
  contexto = useUser();
  return null;
}

const CLIENTE = { id: 'cli-1', name: 'Cliente', email: 'cliente@example.com', phone: '', address: {}, createdAt: '2026-01-01' };

const DADOS_DA_CONTA = [
  'sakura_cart',
  'orders_cli-1',
  'coupons_cli-1',
  'japan-express-wishlist_cliente@example.com',
  'japan-express-users',
  'kimiclaw_messages_v1',
  'sandbox_recent_searches',
  'affiliate_ref',
  'chave_que_ninguem_listou',
];
const PREFERENCIAS = ['preferred-language', 'sakura_selected_country', 'cookie_consent', 'firebase:authUser:abc:[DEFAULT]'];

function gravarSessaoDoCliente() {
  localStorage.setItem('user', JSON.stringify(CLIENTE));
  for (const k of [...DADOS_DA_CONTA, ...PREFERENCIAS]) localStorage.setItem(k, '[]');
  sessionStorage.setItem('jp_referral', 'ref-1');
  sessionStorage.setItem('chunk_reload_at', '1');
}

function esperarSoPreferencias() {
  for (const k of DADOS_DA_CONTA) expect(localStorage.getItem(k), k).toBeNull();
  for (const k of PREFERENCIAS) expect(localStorage.getItem(k), k).toBe('[]');
  expect(sessionStorage.getItem('jp_referral')).toBeNull();
  expect(sessionStorage.getItem('chunk_reload_at')).toBe('1');
}

describe('dados locais da conta', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mocks.authenticate.mockReset();
    mocks.signInWithEmailAndPassword.mockReset();
  });

  it('logout apaga os dados da conta e mantém as preferências do aparelho', async () => {
    gravarSessaoDoCliente();
    render(<UserProvider><Probe /></UserProvider>);
    await waitFor(() => expect(contexto.user?.id).toBe('cli-1'));

    await act(async () => { await contexto.logout(); });

    expect(localStorage.getItem('user')).toBeNull();
    esperarSoPreferencias();
  });

  it('entrar com outra conta apaga os dados da anterior antes de gravar a nova', async () => {
    gravarSessaoDoCliente();
    mocks.authenticate.mockResolvedValue({ username: ADMIN_EMAIL, name: 'Administrador', role: 3 });
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'admin-uid' } });
    render(<UserProvider><Probe /></UserProvider>);
    await waitFor(() => expect(contexto.user?.id).toBe('cli-1'));

    await act(async () => { await contexto.login(ADMIN_EMAIL, 'senha-correta'); });

    expect(JSON.parse(localStorage.getItem('user') || '{}').id).toBe('admin-001');
    esperarSoPreferencias();
  });

  it('o mesmo usuário voltando não perde nada', async () => {
    gravarSessaoDoCliente();
    render(<UserProvider><Probe /></UserProvider>);
    await waitFor(() => expect(contexto.user?.id).toBe('cli-1'));

    act(() => { contexto.updateProfile({ name: 'Novo Nome' }); });

    expect(localStorage.getItem('orders_cli-1')).toBe('[]');
    expect(localStorage.getItem('japan-express-wishlist_cliente@example.com')).toBe('[]');
  });
});
