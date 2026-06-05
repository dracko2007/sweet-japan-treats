import React, { useState, useEffect } from 'react';
import { Users, ShoppingBag, DollarSign, TrendingUp, Package, Calendar, Mail, Phone, Trash2, AlertTriangle, Gift, X, Sparkles, Megaphone } from 'lucide-react';
import { affiliateService, AffiliateRequest } from '@/services/affiliateService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { customerService, CustomerStats } from '@/services/customerService';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { requireAdminPassword } from '@/utils/adminGuard';
import { useUser } from '@/context/UserContext';
import type { Coupon } from '@/context/UserContext';

const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null);
  const { toast } = useToast();
  const { permissions } = useUser();
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
    const code = window.prompt(`Código do afiliado para "${req.name}" (o que o cliente divulga):`, suggestCode(req.name));
    if (!code) return;
    const disc = Number(window.prompt('Desconto que o cupom dá ao comprador (%):', '10')) || 10;
    const comm = Number(window.prompt('Comissão do afiliado por venda (%):', '10')) || 10;
    if (!requireAdminPassword(`aprovar o afiliado ${req.name}`)) return;
    const res = await affiliateService.approveRequest(req, { code, discountPercent: disc, commissionPercent: comm });
    if (res.ok) { toast({ title: '✅ Afiliado aprovado', description: `${req.name} · código ${code.toUpperCase()}` }); loadAffRequests(); }
    else toast({ title: 'Erro ao aprovar', description: res.error, variant: 'destructive' });
  };

  const rejectAff = async (req: AffiliateRequest) => {
    if (!confirm(`Recusar a solicitação de afiliado de "${req.name}"?`)) return;
    if (!requireAdminPassword(`recusar o afiliado ${req.name}`)) return;
    const ok = await affiliateService.rejectRequest(req.email);
    if (ok) { toast({ title: 'Solicitação recusada', description: req.name }); loadAffRequests(); }
    else toast({ title: 'Erro ao recusar', variant: 'destructive' });
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

  // Conceder/ajustar pontos de fidelidade de um cliente
  const handleGrantPoints = async (email: string, name: string) => {
    const input = window.prompt(`Quantos pontos somar a "${name}"?\n(use número negativo para descontar)`, '1000');
    if (input === null) return;
    const amount = Math.trunc(Number(input));
    if (!amount || isNaN(amount)) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    if (!requireAdminPassword(`ajustar pontos de ${name}`)) return;
    await ensureAdminAuth();
    const res = await firebaseSyncService.addPointsToUserByEmail(email, amount);
    if (res.success) {
      toast({ title: `✨ ${amount > 0 ? '+' : ''}${amount} pontos`, description: `${name} agora tem ${res.total} pontos.` });
      loadCustomers();
    } else {
      toast({ title: 'Não foi possível ajustar', description: res.error, variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const allCustomers = await customerService.getAllCustomersAsync();
    const stats = await customerService.getCustomerOverviewAsync();
    setCustomers(allCustomers);
    setOverview(stats);
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
    if (!permissions.canDelete) return denyDelete();
    if (!confirm(`Deletar histórico de pedidos de "${customerName}"?\n\n⚠️ Essa ação não pode ser desfeita!`)) {
      return;
    }
    if (!requireAdminPassword(`deletar o histórico de ${customerName}`)) return;
    const success = await customerService.deleteCustomerOrders(email);
    if (success) {
      toast({
        title: '✅ Histórico deletado',
        description: `Pedidos de ${customerName} foram removidos`,
      });
      loadCustomers();
      if (selectedCustomer?.email === email) {
        setSelectedCustomer(null);
      }
    } else {
      toast({
        title: '❌ Erro ao deletar histórico',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCustomer = async (email: string, customerName: string) => {
    if (!permissions.canDelete) return denyDelete();
    if (!confirm(`Deletar cliente "${customerName}" e TODO seu histórico?\n\n⚠️ Essa ação não pode ser desfeita!`)) {
      return;
    }
    if (!requireAdminPassword(`deletar o cliente ${customerName}`)) return;
    const success = await customerService.deleteCustomer(email);
    if (success) {
      toast({
        title: '✅ Cliente deletado',
        description: `${customerName} foi removido`,
      });
      loadCustomers();
      if (selectedCustomer?.email === email) {
        setSelectedCustomer(null);
      }
    } else {
      toast({
        title: '❌ Erro ao deletar cliente',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAllCustomers = async () => {
    if (!permissions.canDelete) return denyDelete();
    if (!confirm('⚠️ DELETAR TODOS OS CLIENTES?\n\nEssa ação é IRREVERSÍVEL e removerá tudo!')) {
      return;
    }
    if (!confirm('Tem CERTEZA? Digite "SIM" para confirmar:\n\n[Clique OK e confirme novamente]')) {
      return;
    }
    if (!requireAdminPassword('deletar TODOS os clientes')) return;
    const success = await customerService.deleteAllCustomers();
    if (success) {
      toast({
        title: '✅ Todos os clientes foram deletados',
        variant: 'destructive',
      });
      loadCustomers();
      setSelectedCustomer(null);
    }
  };

  const handleDeleteAllOrderHistory = async () => {
    if (!permissions.canFinancial) {
      toast({ title: 'Sem permissão', description: 'Resetar histórico é financeiro (Nível 3).', variant: 'destructive' });
      return;
    }
    if (!confirm('⚠️ DELETAR TODO O HISTÓRICO DE PEDIDOS?\n\nEssa ação é IRREVERSÍVEL!')) {
      return;
    }
    if (!requireAdminPassword('deletar TODO o histórico de pedidos')) return;
    const success = await customerService.deleteAllOrderHistory();
    if (success) {
      toast({
        title: '✅ Todo o histórico de pedidos foi deletado',
        variant: 'destructive',
      });
      loadCustomers();
      setSelectedCustomer(null);
    }
  };

  if (!overview) {
    return <div className="text-center py-8">Carregando...</div>;
  }

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
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5" />
              Ações em Massa
            </h3>
            <p className="text-xs text-red-600 dark:text-red-300">Operações irreversíveis. Use com cuidado!</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-primary hover:text-primary border-primary/30 whitespace-nowrap"
              onClick={() => setGrantTarget('ALL')}
            >
              <Gift className="w-4 h-4 mr-1" />
              Dar cupom a todos
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-orange-600 hover:text-orange-700 border-orange-200 whitespace-nowrap"
              onClick={handleDeleteAllOrderHistory}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Limpar Todo Histórico
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="whitespace-nowrap"
              onClick={handleDeleteAllCustomers}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Deletar Todos
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {overview.activeCustomers} ativos · {overview.inactiveCustomers} inativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {overview.totalOrders} pedidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Cliente</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview.averageRevenuePerCustomer)}</div>
            <p className="text-xs text-muted-foreground">
              {overview.averageOrdersPerCustomer.toFixed(1)} pedidos/cliente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {((overview.activeCustomers / overview.totalCustomers) * 100).toFixed(0)}% do total
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
                        <h3 className="font-semibold text-base sm:text-lg truncate">{customer.name}</h3>
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
                      className="text-xs flex-1"
                      onClick={() => handleDeleteCustomerOrders(customer.email, customer.name)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Limpar Histórico
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
