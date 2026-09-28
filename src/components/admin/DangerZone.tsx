import React from 'react';
import { AlertTriangle, Bomb, ShoppingBag, Sparkles, Star, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm, type ConfirmField } from '@/components/ConfirmDialog';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { customerService } from '@/services/customerService';
import { negotiationService } from '@/services/negotiationService';
import { promoCampaignService } from '@/services/promoCampaignService';
import { reviewService } from '@/services/reviewService';
import { safeStorage } from '@/utils/storage';

const TYPED_FIELD: ConfirmField = { name: 'typed', label: 'Digite APAGAR para confirmar' };

const reloadSoon = () => setTimeout(() => window.location.reload(), 1200);

/** Limpeza local do reset completo: carrinho, pedidos e pontos guardados no navegador. */
const clearLocalSiteData = () => {
  // Remove também o consentimento de cookies para o banner reaparecer
  // (Ctrl+Shift+R não limpa o localStorage).
  ['cookie_consent', 'sakura_orders', 'redeem_points', 'sakura_cart', 'activeNegId'].forEach((k) => safeStorage.removeItem(k));
  try {
    const raw = safeStorage.getItem('japan-express-users');
    if (raw) {
      const users = JSON.parse(raw) as Record<string, { orders?: unknown[]; points?: number }>;
      Object.values(users).forEach((u) => { u.orders = []; u.points = 0; });
      safeStorage.setItem('japan-express-users', JSON.stringify(users));
    }
  } catch { /* localStorage legado corrompido/indisponível */ }
  safeStorage.keys().filter((k) => k.startsWith('orders_') || k.startsWith('promo_bought_')).forEach((k) => safeStorage.removeItem(k));
};

interface DangerAction {
  key: string;
  icon: React.ElementType;
  title: string;
  explanation: string;
  button: string;
  run: () => void;
}

/** Ações em massa irreversíveis (Nível 3): cada uma pede confirmação + senha do admin. */
const DangerZone: React.FC = () => {
  const { toast } = useToast();
  const { permissions } = useUser();
  const confirm = useConfirm();

  if (!permissions.canFinancial) return null;

  const resetOrders = async () => {
    let removed = 0;
    const values = await confirm({
      title: 'Apagar todos os pedidos?',
      details: [
        'Remove todos os pedidos do banco e do navegador, inclusive o "Comprar novamente" dos clientes',
        'Mantém: clientes, pontos, cupons, negociações e produtos',
        'Esta ação não pode ser desfeita',
      ],
      destructive: true,
      password: true,
      permission: 'financial',
      confirmLabel: 'Apagar pedidos',
      onConfirm: async () => {
        removed = await orderService.clearAllOrders();
        safeStorage.keys().filter((k) => k.startsWith('promo_bought_')).forEach((k) => safeStorage.removeItem(k));
      },
    });
    if (!values) return;
    toast({ title: '🧹 Histórico resetado', description: `${removed} pedido(s) removidos do banco + dados locais limpos. Recarregando...` });
    reloadSoon();
  };

  const resetPoints = async () => {
    let users = 0;
    const values = await confirm({
      title: 'Zerar os pontos de todos os clientes?',
      details: [
        'O saldo de pontos de fidelidade de cada cliente volta a zero',
        'Mantém: contas, pedidos e cupons',
        'Esta ação não pode ser desfeita',
      ],
      destructive: true,
      password: true,
      permission: 'financial',
      confirmLabel: 'Zerar pontos',
      onConfirm: async () => {
        const res = await firebaseSyncService.resetAllPoints();
        if (!res.success) throw new Error('Não foi possível zerar os pontos de todos os clientes. Tente novamente.');
        users = res.users;
      },
    });
    if (!values) return;
    toast({ title: '✨ Pontos zerados', description: `${users} cliente(s) com pontos zerados.` });
  };

  const resetReviews = async () => {
    let removed = 0;
    const values = await confirm({
      title: 'Apagar todas as avaliações?',
      details: [
        'Remove as estrelas, comentários e fotos de todas as avaliações',
        'A nota e o número de avaliações de cada produto voltam a zero',
        'Mantém: clientes, produtos e pontos já ganhos com avaliações',
        'Esta ação não pode ser desfeita',
      ],
      destructive: true,
      password: true,
      permission: 'financial',
      confirmLabel: 'Apagar avaliações',
      onConfirm: async () => {
        removed = await reviewService.deleteAllReviews();
      },
    });
    if (!values) return;
    toast({ title: '⭐ Avaliações apagadas', description: `${removed} avaliação(ões) de produtos removidas.` });
  };

  const deleteAllCustomers = async () => {
    const values = await confirm({
      title: 'Excluir todos os clientes?',
      details: [
        'Remove as contas de todos os clientes, com pontos, cupons e dados de perfil',
        'Mantém: pedidos, negociações, produtos e configurações',
        'Esta ação não pode ser desfeita',
      ],
      destructive: true,
      password: true,
      permission: 'financial',
      confirmLabel: 'Excluir clientes',
      fields: [TYPED_FIELD],
      onConfirm: async (v) => {
        if (v.typed !== 'APAGAR') throw new Error('Digite APAGAR para confirmar.');
        if (!(await customerService.deleteAllCustomers())) {
          throw new Error('Não foi possível excluir todos os clientes. Tente novamente.');
        }
      },
    });
    if (!values) return;
    toast({ title: '✅ Todos os clientes foram deletados', variant: 'destructive' });
    reloadSoon();
  };

  const fullSiteReset = async () => {
    const values = await confirm({
      title: 'Fazer o reset completo do site?',
      details: [
        'Apaga todos os pedidos e todas as negociações',
        'Zera os pontos de fidelidade e os cupons de todos os clientes',
        'Apaga o histórico de uso de cupons',
        'Apaga as campanhas promocionais e o feed de notificações',
        'Mantém: contas, produtos, configurações',
        'Esta ação não pode ser desfeita',
      ],
      destructive: true,
      password: true,
      permission: 'financial',
      confirmLabel: 'Resetar tudo',
      fields: [TYPED_FIELD],
      onConfirm: async (v) => {
        if (v.typed !== 'APAGAR') throw new Error('Digite APAGAR para confirmar.');
        const [ordersOk, , couponUsageOk] = await Promise.all([
          firebaseSyncService.deleteAllOrdersFromFirestore(),
          negotiationService.deleteAllNegotiations(),
          firebaseSyncService.deleteAllCouponUsage(),
          firebaseSyncService.resetAllUsersData(),
          promoCampaignService.deleteAllCampaignData(),
        ]);
        clearLocalSiteData();
        if (!ordersOk || !couponUsageOk) {
          throw new Error('Alguns dados podem não ter sido apagados. Tente novamente.');
        }
      },
    });
    if (!values) return;
    toast({ title: '✅ Reset completo realizado!', description: 'Pedidos, negociações, pontos e cupons foram zerados.' });
    reloadSoon();
  };

  const actions: DangerAction[] = [
    { key: 'orders', icon: ShoppingBag, title: 'Apagar todos os pedidos', explanation: 'Remove todos os pedidos (banco + navegador). Use para limpar dados de teste.', button: 'Apagar pedidos', run: resetOrders },
    { key: 'points', icon: Sparkles, title: 'Zerar pontos de todos os clientes', explanation: 'O saldo de pontos de fidelidade de todos os clientes volta a zero.', button: 'Zerar pontos', run: resetPoints },
    { key: 'reviews', icon: Star, title: 'Apagar todas as avaliações', explanation: 'Remove estrelas e comentários e zera a nota dos produtos. Clientes e produtos ficam.', button: 'Apagar avaliações', run: resetReviews },
    { key: 'customers', icon: Users, title: 'Excluir todos os clientes', explanation: 'Remove as contas de todos os clientes. Os pedidos continuam no histórico.', button: 'Excluir clientes', run: deleteAllCustomers },
    { key: 'site', icon: Bomb, title: 'Reset completo do site', explanation: 'Zera pedidos, negociações, pontos, cupons e campanhas. Mantém contas, produtos e configurações.', button: 'Resetar tudo', run: fullSiteReset },
  ];

  return (
    <Card className="border-red-300 dark:border-red-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" /> Zona de perigo
        </CardTitle>
        <CardDescription>Ações em massa e irreversíveis. Cada uma pede confirmação e a senha do admin.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-red-100 dark:divide-red-950">
        {actions.map(({ key, icon: Icon, title, explanation, button, run }) => (
          <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{explanation}</p>
              </div>
            </div>
            <Button
              onClick={run}
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 border-red-400 text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
              {button}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default DangerZone;
