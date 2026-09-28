import React, { useState, useEffect } from 'react';
import { Users, ShoppingBag, DollarSign, TrendingUp, Package, Calendar, Mail, Phone, Trash2, AlertTriangle, Gift, X, Sparkles, Megaphone, RefreshCw, Handshake, UserX, MailCheck, Instagram, Music } from 'lucide-react';
import { affiliateService, AffiliateRequest } from '@/services/affiliateService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { customerService, CustomerStats, CustomerVerification } from '@/services/customerService';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { negotiationService } from '@/services/negotiationService';
import { promoCampaignService } from '@/services/promoCampaignService';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { useConfirm } from '@/components/ConfirmDialog';
import { orderService } from '@/services/orderService';
import { safeStorage } from '@/utils/storage';
import { useUser } from '@/context/UserContext';
import type { Coupon } from '@/context/UserContext';
import { resendVerificationAsAdmin } from '@/services/mailService';

const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [verification, setVerification] = useState<Map<string, CustomerVerification>>(new Map());
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null);
  const { toast } = useToast();
  const { permissions } = useUser();
  const confirm = useConfirm();
  const denyDelete = () => toast({ title: 'Sem permissão', description: 'Seu nível não permite excluir. (Nível 2+)', variant: 'destructive' });
  const customersPagination = usePagination(customers, 8);

  // Concessão de cupom (admin → perfil do cliente)
  const [grantTarget, setGrantTarget] = useState<{ email: string; name: string } | 'ALL' | null>(null);
  const [granting, setGranting] = useState(false);

  // Solicitações de afiliado pendentes
  const [affRequests, setAffRequests] = useState<AffiliateRequest[]>([]);
  const loadAffRequests = () => affiliateService.getRequests('pending').then(setAffRequests);
  useEffect(() => { loadAffRequests(); }, []);

  const suggestCode = (name: string) =>
    (name || 'AFILIADO').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 8) + '10';

  const approveAff = async (req: AffiliateRequest) => {
    const values = await confirm({
      title: `Aprovar afiliado "${req.name}"?`,
      password: true,
      permission: 'delete',
      confirmLabel: 'Aprovar afiliado',
      fields: [
        { name: 'code', label: 'Código do afiliado', defaultValue: suggestCode(req.name), hint: 'Código que o cliente divulga' },
        { name: 'discount', label: 'Desconto ao comprador (%)', type: 'number', defaultValue: '10' },
        { name: 'commission', label: 'Comissão por venda (%)', type: 'number', defaultValue: '10' },
      ],
      onConfirm: async (vals) => {
        const code = (vals.code || suggestCode(req.name)).trim().toUpperCase();
        const disc = Number(vals.discount) || 10;
        const comm = Number(vals.commission) || 10;
        const res = await affiliateService.approveRequest(req, { code, discountPercent: disc, commissionPercent: comm });
        if (!res.ok) throw new Error(res.error || 'Erro ao aprovar afiliado.');
      },
    });
    if (!values) return;
    toast({ title: '✅ Afiliado aprovado', description: `${req.name} · código ${(values.code || suggestCode(req.name)).toUpperCase()}` });
    loadAffRequests();
  };

  const rejectAff = async (req: AffiliateRequest) => {
    const done = await confirm({
      title: `Recusar solicitação de "${req.name}"?`,
      details: ['A solicitação de afiliado será rejeitada.'],
      destructive: true,
      password: true,
      permission: 'delete',
      confirmLabel: 'Recusar',
      onConfirm: async () => {
        const ok = await affiliateService.rejectRequest(req.email);
        if (!ok) throw new Error('Não foi possível recusar a solicitação.');
      },
    });
    if (!done) return;
    toast({ title: 'Solicitação recusada', description: req.name });
    loadAffRequests();
  };
  const [grantForm, setGrantForm] = useState({
    code: '',
    description: '',
    discount: 10,
    discountType: 'percentage' as 'percentage' | 'fixed',
    validityDays: 30,
  });

  const handleGrantCoupon = async () => {
    const code = grantForm.code.trim().toUpperCase();
    if (!code || grantForm.discount <= 0) {
      toast({ title: 'Preencha o código e o valor do desconto', variant: 'destructive' });
      return;
    }
    const coupon: Coupon = {
      id: `grant-${Date.now()}`,
      code,
      description: grantForm.description.trim() || `Cupom ${code}`,
      discount: Number(grantForm.discount),
      discountType: grantForm.discountType,
      expiresAt: new Date(Date.now() + grantForm.validityDays * 86400000).toISOString(),
      isUsed: false,
    };

    setGranting(true);
    try {
      await ensureAdminAuth();
      const res =
        grantTarget === 'ALL'
          ? await firebaseSyncService.grantCouponToAllUsers(coupon)
          : await firebaseSyncService.grantCouponToUserByEmail(grantTarget!.email, coupon);

      if (res.success) {
        toast({
          title: '🎟️ Cupom concedido',
          description:
            grantTarget === 'ALL'
              ? `${code} enviado para ${res.granted} cliente(s)`
              : `${code} adicionado a ${(grantTarget as { name: string }).name}`,
        });
        setGrantTarget(null);
        setGrantForm({ code: '', description: '', discount: 10, discountType: 'percentage', validityDays: 30 });
      } else {
        toast({ title: 'Erro ao conceder cupom', description: res.error, variant: 'destructive' });
      }
    } finally {
      setGranting(false);
    }
  };

  // Reenvia a confirmação de e-mail. O envio automático depende da sessão do
  // cliente no navegador dele; quando falha, a conta fica criada sem que o link
  // tenha saído e ninguém percebe. Daqui o envio é autenticado como admin.
  const handleResendVerification = async (email: string, name: string) => {
    await ensureAdminAuth();
    const r = await resendVerificationAsAdmin(email, name);
    if (r.ok) {
      toast({ title: '✅ Confirmação reenviada', description: `Link enviado para ${email}. Peça para conferir também o spam.` });
      return;
    }
    // Cada causa pede uma ação diferente do dono da loja — um "não deu" genérico
    // deixaria ele sem saber se o problema é a própria sessão, permissão ou o SMTP.
    const motivos: Record<string, string> = {
      sem_sessao: 'Sua sessão do Firebase expirou. Saia e entre de novo no painel.',
      unauthorized: 'Sessão expirada ou sem token. Saia e entre de novo no painel.',
      forbidden: 'Esta conta não é reconhecida como admin pelo servidor. Confira ADMIN_EMAIL na Vercel e se o e-mail está verificado no Firebase Auth.',
      email_not_configured: 'Falta a variável NOREPLY_EMAIL_PASSWORD na Vercel.',
      email_auth_failed: 'O Gmail recusou a credencial de SMTP (535). Confira SMTP_USER (precisa ser conta real, não alias) e a App Password na Vercel.',
      email_rejected_by_smtp: `O Gmail recusou o endereço ${email}. Confira se está escrito certo.`,
      rate_limited: 'Limite de envios por hora atingido. Tente daqui a pouco.',
      firebase_admin_not_configured: 'Firebase Admin sem credencial na Vercel (FIREBASE_SERVICE_ACCOUNT_JSON).',
    };
    toast({
      title: 'Não foi possível reenviar',
      description: motivos[r.error || ''] || `Erro do servidor: ${r.error}${r.status ? ` (HTTP ${r.status})` : ''}`,
      variant: 'destructive',
    });
  };

  // Conceder/ajustar pontos de fidelidade de um cliente
  const handleGrantPoints = async (email: string, name: string) => {
    let newTotal = 0;
    const values = await confirm({
      title: `Ajustar pontos de fidelidade: ${name}`,
      description: 'Use número positivo para somar ou negativo para descontar.',
      password: true,
      permission: 'financial',
      confirmLabel: 'Ajustar pontos',
      fields: [
        { name: 'amount', label: 'Quantidade de pontos', type: 'number', defaultValue: '1000' },
      ],
      onConfirm: async (vals) => {
        const amount = Math.trunc(Number(vals.amount));
        if (!amount || isNaN(amount)) throw new Error('Valor de pontos inválido.');
        await ensureAdminAuth();
        const res = await firebaseSyncService.addPointsToUserByEmail(email, amount);
        if (!res.success) throw new Error(res.error || 'Não foi possível ajustar pontos.');
        newTotal = res.total;
      },
    });
    if (!values) return;
    const amount = Math.trunc(Number(values.amount));
    toast({ title: `✨ ${amount > 0 ? '+' : ''}${amount} pontos`, description: `${name} agora tem ${newTotal} pontos.` });
    loadCustomers();
  };

  const handleToggleSocialFollow = async (email: string, name: string, network: 'instagram' | 'tiktok', currentValue: boolean) => {
    const networkLabel = network === 'instagram' ? 'Instagram' : 'TikTok';
    const nextState = !currentValue;
    const done = await confirm({
      title: `${nextState ? 'Marcar' : 'Desmarcar'} ${networkLabel} de ${name}?`,
      details: [
        nextState
          ? `Registra que ${name} segue a loja no ${networkLabel} (concede pontos de recompensa).`
          : `Remove a marcação de ${networkLabel} deste cliente.`,
      ],
      password: true,
      permission: 'financial',
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        await ensureAdminAuth();
        const res = await firebaseSyncService.setSocialFollowByEmail(email, network, nextState);
        if (!res.success) throw new Error(res.error || 'Não foi possível atualizar rede social.');
      },
    });
    if (!done) return;
    toast({ title: `✅ ${networkLabel} atualizado`, description: `${name} ${nextState ? 'agora segue' : 'deixou de seguir'} no ${networkLabel}.` });
    loadCustomers();
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);

  const loadCustomers = async () => {
    try {
      const [allCustomers, stats, verifyMap] = await Promise.all([
        withTimeout(customerService.getAllCustomersAsync(), 8_000, []),
        withTimeout(customerService.getCustomerOverviewAsync(), 8_000, null),
        withTimeout(customerService.getCustomerVerificationAsync(), 8_000, new Map()),
      ]);
      setCustomers(allCustomers);
      setOverview(stats);
      setVerification(verifyMap);
    } catch {
      setCustomers([]);
      setOverview(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pendente',
      processing: 'Processando',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleDeleteCustomerOrders = async (email: string, customerName: string) => {
    const done = await confirm({
      title: `Excluir histórico de pedidos de ${customerName}?`,
      details: [
        'Todos os pedidos deste cliente serão apagados de Pedidos, do financeiro e do perfil.',
        'A conta do cliente e os dados cadastrais continuam existindo.',
      ],
      destructive: true,
      password: true,
      permission: 'delete',
      onConfirm: async () => {
        const count = await orderService.deleteOrdersByCustomer(email, selectedCustomer?.id);
        toast({
          title: '✅ Histórico deletado',
          description: `${count} pedido(s) de ${customerName} foram removidos`,
        });
      },
    });
    if (!done) return;
    loadCustomers();
    if (selectedCustomer?.email === email) {
      setSelectedCustomer(null);
    }
  };

  const handleDeleteCustomer = async (email: string, customerName: string) => {
    const done = await confirm({
      title: `Excluir o cliente ${customerName}?`,
      details: [
        'Conta e dados de perfil (pontos, cupons, endereços) serão apagados.',
        'Os pedidos continuam em Pedidos e no financeiro.',
      ],
      destructive: true,
      password: true,
      permission: 'delete',
      onConfirm: async () => {
        const ok = await customerService.deleteCustomer(email);
        if (!ok) throw new Error('Não foi possível excluir o cliente no Firestore.');
      },
    });
    if (!done) return;
    toast({
      title: '✅ Cliente deletado',
      description: `${customerName} foi removido`,
    });
    loadCustomers();
    if (selectedCustomer?.email === email) {
      setSelectedCustomer(null);
    }
  };

  const handleDeleteCustomerNegotiations = async (email: string, customerName: string) => {
    const done = await confirm({
      title: `Excluir negociações de ${customerName}?`,
      details: [
        'Todas as propostas negociadas deste cliente serão apagadas.',
        'Elas sumirão do perfil do cliente e da aba Negociações.',
      ],
      destructive: true,
      password: true,
      permission: 'delete',
      onConfirm: async () => {
        await negotiationService.deleteNegotiationsByEmail(email);
      },
    });
    if (!done) return;
    toast({ title: '🗑️ Negociações deletadas', description: `Negociações de ${customerName} removidas` });
  };

  const handleUnlinkAffiliate = async (email: string, name: string) => {
    const done = await confirm({
      title: `Desvincular afiliado de ${name}?`,
      details: [
        'Remove o código de afiliado e referral do perfil do cliente.',
        'O histórico de compras anteriores é preservado.',
      ],
      destructive: true,
      password: true,
      permission: 'delete',
      onConfirm: async () => {
        await ensureAdminAuth();
        const res = await firebaseSyncService.unlinkAffiliateFromUser(email);
        if (!res.success) throw new Error(res.error || 'Erro ao desvincular afiliado.');
      },
    });
    if (!done) return;
    toast({ title: '✅ Afiliado desvinculado', description: `${name} não tem mais afiliado vinculado.` });
    loadCustomers();
  };

  // overview pode ser null se Firestore travou — usa objeto vazio para não quebrar a UI
  const ov = overview ?? {
    totalCustomers: customers.length,
    activeCustomers: 0,
    inactiveCustomers: 0,
    totalRevenue: 0,
    totalOrders: 0,
    averageRevenuePerCustomer: 0,
    averageOrdersPerCustomer: 0,
  };

  // Selo de verificação de e-mail: o Firestore não guarda emailVerified, então
  // o status vem do Firebase Auth (via /api/admin?action=customers-verification).
  // Sem o mapa (ex.: vite dev puro) o selo é omitido em vez de mostrar dado falso.
  const verifiedCount = customers.filter((c) => verification.get(c.email.toLowerCase())?.verified).length;
  const verificationBadge = (email: string) => {
    const v = verification.get(email.toLowerCase());
    if (!v) return null;
    return v.verified ? (
      <span
        title="E-mail confirmado no Firebase Auth"
        className="inline-flex items-center gap-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
      >
        <MailCheck className="w-3 h-3" /> Verificado
      </span>
    ) : (
      <span
        title="E-mail ainda NÃO confirmado — o cadastro não foi concluído e o cliente não consegue entrar"
        className="inline-flex items-center gap-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
      >
        <AlertTriangle className="w-3 h-3" /> Não confirmado
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Solicitações de afiliado pendentes */}
      {affRequests.length > 0 && (
        <div className="bg-primary/5 border border-primary/30 rounded-lg p-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
            <Megaphone className="w-5 h-5 text-primary" />
            Solicitações de afiliado ({affRequests.length})
          </h3>
          <div className="space-y-2">
            {affRequests.map((r) => (
              <div key={r.email} className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{r.name || r.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email} · {new Date(r.requestedAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => approveAff(r)} size="sm" className="btn-primary gap-1.5">
                    <Megaphone className="w-4 h-4" /> Aprovar
                  </Button>
                  <Button onClick={() => rejectAff(r)} size="sm" variant="outline" className="gap-1.5 text-red-600">
                    <X className="w-4 h-4" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botões de Ação em Massa */}
      {/* Conceder cupom em massa */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="text-primary hover:text-primary border-primary/30"
          onClick={() => setGrantTarget('ALL')}
        >
          <Gift className="w-4 h-4 mr-1.5" />
          Dar cupom a todos os clientes
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ov.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {verification.size > 0
                ? `${verifiedCount} verificados · ${ov.activeCustomers} ativos · ${ov.inactiveCustomers} inativos`
                : `${ov.activeCustomers} ativos · ${ov.inactiveCustomers} inativos`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ov.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {ov.totalOrders} pedidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Cliente</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ov.averageRevenuePerCustomer)}</div>
            <p className="text-xs text-muted-foreground">
              {ov.averageOrdersPerCustomer.toFixed(1)} pedidos/cliente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ov.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {((ov.activeCustomers / ov.totalCustomers) * 100).toFixed(0)}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Clientes */}
        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold">Clientes</h2>
          <div className="space-y-3 max-h-[500px] lg:max-h-[600px] overflow-y-auto">
            {customers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado</p>
              </div>
            ) : customersPagination.pageItems.map((customer) => (
              <Card
                key={customer.email}
                className={`transition-all hover:shadow-md ${
                  selectedCustomer?.email === customer.email ? 'ring-2 ring-primary' : ''
                }`}
              >
                <CardContent className="p-3 sm:p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{customer.name}</h3>
                          {verificationBadge(customer.email)}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </p>
                        {customer.phone !== 'N/A' && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {customer.phone}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base sm:text-lg font-bold text-primary">{formatCurrency(customer.totalSpent)}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">{customer.totalOrders} pedidos</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1 text-primary border-primary/30 hover:bg-primary/5"
                      onClick={() => setGrantTarget({ email: customer.email, name: customer.name })}
                    >
                      <Gift className="w-3 h-3 mr-1" />
                      Dar cupom
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1 text-purple-700 border-purple-300 hover:bg-purple-50"
                      onClick={() => handleGrantPoints(customer.email, customer.name)}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Dar pontos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs flex-1 ${customer.socialFollows?.instagram ? 'bg-pink-50 text-pink-700 border-pink-300' : 'text-pink-600 border-pink-200 hover:bg-pink-50'}`}
                      onClick={() => handleToggleSocialFollow(customer.email, customer.name, 'instagram', Boolean(customer.socialFollows?.instagram))}
                    >
                      <Instagram className="w-3 h-3 mr-1" />
                      {customer.socialFollows?.instagram ? 'IG ✓' : 'IG'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs flex-1 ${customer.socialFollows?.tiktok ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                      onClick={() => handleToggleSocialFollow(customer.email, customer.name, 'tiktok', Boolean(customer.socialFollows?.tiktok))}
                    >
                      <Music className="w-3 h-3 mr-1" />
                      {customer.socialFollows?.tiktok ? 'TT ✓' : 'TT'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => handleResendVerification(customer.email, customer.name)}
                    >
                      <MailCheck className="w-3 h-3 mr-1" />
                      Reenviar confirmação
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1"
                      onClick={() => handleDeleteCustomerOrders(customer.email, customer.name)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Limpar Histórico
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => handleDeleteCustomerNegotiations(customer.email, customer.name)}
                    >
                      <Handshake className="w-3 h-3 mr-1" />
                      Limpar Negociações
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => handleUnlinkAffiliate(customer.email, customer.name)}
                    >
                      <UserX className="w-3 h-3 mr-1" />
                      Desvincular Afiliado
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs flex-1"
                      onClick={() => handleDeleteCustomer(customer.email, customer.name)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Deletar Cliente
                    </Button>
                  </div>
                  
                  {customer.totalOrders > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Último pedido: {formatDate(customer.lastOrderDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Média: {formatCurrency(customer.averageOrderValue)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {customers.length > 0 && (
            <Pagination
              page={customersPagination.page}
              totalPages={customersPagination.totalPages}
              onPageChange={customersPagination.setPage}
              rangeStart={customersPagination.rangeStart}
              rangeEnd={customersPagination.rangeEnd}
              total={customersPagination.total}
            />
          )}
        </div>

        {/* Detalhes do Cliente Selecionado */}
        <div className="space-y-4">
          {selectedCustomer ? (
            <>
              <h2 className="text-2xl font-bold">Detalhes do Cliente</h2>
              
              {/* Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{selectedCustomer.name}</CardTitle>
                  <CardDescription>{selectedCustomer.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Gasto</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedCustomer.totalSpent)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                      <p className="text-xl font-bold">{selectedCustomer.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ticket Médio</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedCustomer.averageOrderValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Último Pedido</p>
                      <p className="text-xl font-bold">{formatDate(selectedCustomer.lastOrderDate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Produtos Favoritos */}
              {selectedCustomer.favoriteProducts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Produtos Mais Comprados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedCustomer.favoriteProducts.map((product, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.quantity} unidades</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(product.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Histórico de Pedidos */}
              {selectedCustomer.orderHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      Histórico de Pedidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {selectedCustomer.orderHistory.map((order, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                          <div>
                            <p className="font-medium">#{order.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(order.date)}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="font-semibold">{formatCurrency(order.total)}</p>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ações de Delete */}
              <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Ações Perigosas
                  </CardTitle>
                  <CardDescription>Cuidado! Essas ações não podem ser desfeitas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-orange-600 hover:text-orange-700 border-orange-200"
                    onClick={() => handleDeleteCustomerOrders(selectedCustomer.email, selectedCustomer.name)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Histórico de Pedidos
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => handleDeleteCustomerNegotiations(selectedCustomer.email, selectedCustomer.name)}
                  >
                    <Handshake className="w-4 h-4 mr-2" />
                    Limpar Negociações
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => handleUnlinkAffiliate(selectedCustomer.email, selectedCustomer.name)}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Desvincular Afiliado
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={() => handleDeleteCustomer(selectedCustomer.email, selectedCustomer.name)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deletar Cliente
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um cliente para ver os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: conceder cupom */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-md shadow-xl border border-border">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                {grantTarget === 'ALL'
                  ? 'Dar cupom a todos os clientes'
                  : `Dar cupom para ${grantTarget.name}`}
              </h3>
              <button onClick={() => setGrantTarget(null)} className="p-2 rounded-full hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-1">Código do cupom</label>
                <input
                  value={grantForm.code}
                  onChange={(e) => setGrantForm({ ...grantForm, code: e.target.value.toUpperCase() })}
                  placeholder="Ex: PRESENTE20"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-semibold block mb-1">Descrição</label>
                <input
                  value={grantForm.description}
                  onChange={(e) => setGrantForm({ ...grantForm, description: e.target.value })}
                  placeholder="Ex: Presente especial"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold block mb-1">Tipo</label>
                  <select
                    value={grantForm.discountType}
                    onChange={(e) =>
                      setGrantForm({ ...grantForm, discountType: e.target.value as 'percentage' | 'fixed' })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor fixo (¥)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1">
                    Desconto {grantForm.discountType === 'percentage' ? '(%)' : '(¥)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={grantForm.discount}
                    onChange={(e) => setGrantForm({ ...grantForm, discount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold block mb-1">Validade (dias)</label>
                <input
                  type="number"
                  min="1"
                  value={grantForm.validityDays}
                  onChange={(e) => setGrantForm({ ...grantForm, validityDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
            </div>

            <div className="p-5 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setGrantTarget(null)}>Cancelar</Button>
              <Button onClick={handleGrantCoupon} disabled={granting} className="btn-primary gap-2">
                <Gift className="w-4 h-4" />
                {granting ? 'Concedendo...' : 'Conceder'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
