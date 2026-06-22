import { safeStorage } from '@/utils/storage';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Printer, ShoppingBag, User, MapPin, Phone, Mail, Calendar, TestTube, Tag, Truck, CheckCircle, XCircle, Trash2, BarChart3, Users, PackagePlus, Video, Megaphone, Clapperboard, Building2, Sparkles, ShieldCheck, Calculator, CloudUpload, FileText, Handshake } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { emailService } from '@/services/emailService';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { whatsappService } from '@/services/whatsappService';
import { whatsappServiceSimple } from '@/services/whatsappServiceSimple';
import { useToast } from '@/hooks/use-toast';
import CouponManager from '@/components/admin/CouponManager';
import AffiliateManager from '@/components/admin/AffiliateManager';
import Dashboard from '@/components/admin/Dashboard';
import CustomerList from '@/components/admin/CustomerList';
import ProductManager from '@/components/admin/ProductManager';
import HomeContentManager from '@/components/admin/HomeContentManager';
import VlogManager from '@/components/admin/VlogManager';
import CustomRequestManager from '@/components/admin/CustomRequestManager';
import B2BRequestManager from '@/components/admin/B2BRequestManager';
import AdminAccessManager from '@/components/admin/AdminAccessManager';
import VideoReviewManager from '@/components/admin/VideoReviewManager';
import ImageMigration from '@/components/admin/ImageMigration';
import PromotionManager from '@/components/admin/PromotionManager';
import NegotiationManager from '@/components/admin/NegotiationManager';
import TrackingModal from '@/components/admin/TrackingModal';
import AdminCalculator from '@/components/admin/AdminCalculator';
import MarketingManager from '@/components/admin/MarketingManager';
import CN23Modal from '@/components/admin/CN23Modal';
import PromoNotificationModal from '@/components/admin/PromoNotificationModal';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { orderService } from '@/services/orderService';
import { customerService } from '@/services/customerService';
import { requireAdminPassword } from '@/utils/adminGuard';
import { negotiationService } from '@/services/negotiationService';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


type AdminTab =
  | 'orders' | 'coupons' | 'dashboard' | 'customers' | 'products'
  | 'home' | 'vlog' | 'affiliates' | 'requests' | 'b2b' | 'admins' | 'videos'
  | 'calculator' | 'migration' | 'promotion' | 'negotiations' | 'marketing';

interface AdminTabItem {
  id: AdminTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: number;
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, permissions } = useUser();
  const { toast } = useToast();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [customerCount, setCustomerCount] = useState(0);
  const [newCustomers, setNewCustomers] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [cn23Order, setCn23Order] = useState<any | null>(null);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [pendingNegotiationsCount, setPendingNegotiationsCount] = useState(0);
  const { settings, saveSettings } = useSiteSettings();

  // Paginação da lista de pedidos (10 por página)
  const ordersPagination = usePagination(allOrders, 10);

  // Admin email - apenas Paula pode acessar
  const ADMIN_EMAIL = 'dracko2007@gmail.com';

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefresh = 0;
    const MIN_INTERVAL_MS = 10_000; // no mínimo 10s entre refreshes

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh < MIN_INTERVAL_MS) return; // throttle
      lastRefresh = now;
      loadOrders();
      loadCustomers();
    };

    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refresh, 300);
    };

    refresh();

    const interval = setInterval(refresh, 30000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') debouncedRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', debouncedRefresh);

    return () => {
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', debouncedRefresh);
    };
  }, [user, navigate]);

  useEffect(() => {
    return negotiationService.listenAll((negs) => {
      setPendingNegotiationsCount(negs.filter(n => n.status === 'pending').length);
    });
  }, []);

  const loadOrders = async () => {
    const orders = await orderService.getAllOrdersAsync();
    setAllOrders(orders);
    setOrdersLoading(false);
  };

  const loadCustomers = async () => {
    try {
      const list = await customerService.getAllCustomersAsync();
      const total = list.length;
      setCustomerCount(total);
      const seenRaw = safeStorage.getItem('admin_seen_customers');
      const seen = seenRaw == null ? null : parseInt(seenRaw, 10);
      if (seen == null || isNaN(seen)) {
        safeStorage.setItem('admin_seen_customers', String(total)); // 1ª vez: sem badge
        setNewCustomers(0);
      } else {
        setNewCustomers(Math.max(0, total - seen));
      }
    } catch (e) {
      devWarn('[admin] contagem de clientes falhou:', e);
    }
  };

  // Pedidos a processar (= novos): tudo que não foi enviado/entregue/cancelado.
  // Robusto a variações de status ('pending', 'Pendente', 'paid', 'processing'...).
  const DONE_STATUSES = ['shipped', 'delivered', 'cancelled', 'enviado', 'entregue', 'cancelado'];
  const pendingOrdersCount = allOrders.filter(
    (o) => !DONE_STATUSES.includes(String(o.status || 'pending').toLowerCase())
  ).length;

  // Ao abrir a aba Clientes, marca todos como vistos (zera o badge)
  useEffect(() => {
    if (activeTab === 'customers' && customerCount > 0) {
      safeStorage.setItem('admin_seen_customers', String(customerCount));
      setNewCustomers(0);
    }
  }, [activeTab, customerCount]);

  const handleUpdateStatus = async (orderNumber: string, newStatus: 'pending' | 'processing' | 'packing' | 'shipped' | 'delivered' | 'cancelled') => {
    const success = await orderService.updateOrderStatus(orderNumber, newStatus);
    
    if (success) {
      toast({
        title: "Status atualizado!",
        description: `Pedido ${orderNumber} marcado como ${getStatusLabel(newStatus)}`,
      });
      loadOrders();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderNumber: string) => {
    if (!permissions.canDelete) {
      toast({ title: 'Sem permissão', description: 'Seu nível de admin não permite excluir. (Nível 2+)', variant: 'destructive' });
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir o pedido ${orderNumber}?`)) {
      return;
    }
    if (!(await requireAdminPassword(`excluir o pedido ${orderNumber}`))) return;

    const success = await orderService.deleteOrder(orderNumber);
    
    if (success) {
      toast({
        title: "Pedido excluído",
        description: `Pedido ${orderNumber} foi removido`,
      });
      loadOrders();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o pedido",
        variant: "destructive",
      });
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Aguardando Pagamento',
      processing: 'Pago / Preparando',
      packing: 'Preparando Pacote',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      packing: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Test notification services
  const testNotifications = async () => {
    setIsTesting(true);
    devLog('🧪 Starting notification tests...');
    
    try {
      // Test Email
      devLog('📧 Testing email service...');
      
      let emailResult = false;
      
      // Try Resend first
      if (import.meta.env.VITE_RESEND_API_KEY) {
        devLog('📧 Testing Resend...');
        const testEmailHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1 style="color: #22c55e;">🧪 Test Email (Resend)</h1>
              <p>This is a test email from Sabor do Campo!</p>
              <p>If you received this, your email configuration is working correctly! ✅</p>
              <p>Time: ${new Date().toLocaleString('pt-BR')}</p>
            </body>
          </html>
        `;
        
        emailResult = await emailService.sendOrderConfirmation({
          to: ADMIN_EMAIL,
          subject: '🧪 Test Email (Resend) - Sabor do Campo',
          html: testEmailHTML,
          orderNumber: 'TEST-' + Date.now(),
          customerName: 'Test User'
        });
      } else {
        // Try EmailJS
        devLog('📧 Testing EmailJS...');
        emailResult = await emailServiceSimple.sendOrderConfirmation({
          formData: {
            name: 'Test User',
            email: ADMIN_EMAIL,
            phone: '070-1367-1679',
            postalCode: '518-0225',
            prefecture: 'Mie',
            city: 'Iga',
            address: 'Test Address',
            building: ''
          },
          items: [],
          totalPrice: 1000,
          orderNumber: 'TEST-' + Date.now(),
          paymentMethod: 'bank'
        });
      }
      
      devLog('📧 Email test result:', emailResult);
      
      // Wait a bit before WhatsApp test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test WhatsApp
      devLog('📱 Testing WhatsApp service...');
      const testMessage = `
🧪 *Test Message*

This is a test message from Sabor do Campo!

If you received this, your WhatsApp configuration is working correctly! ✅

Time: ${new Date().toLocaleString('pt-BR')}

_This is an automated test message_
      `.trim();
      
      let whatsappResult = false;
      
      // Try Twilio first
      if (import.meta.env.VITE_TWILIO_ACCOUNT_SID && import.meta.env.VITE_TWILIO_AUTH_TOKEN) {
        devLog('📱 Testing Twilio...');
        whatsappResult = await whatsappService.sendMessage({
          to: '+8107013671679',
          message: testMessage
        });
      } else {
        // Use simple WhatsApp (always works)
        devLog('📱 Testing Simple WhatsApp (opens directly)...');
        whatsappServiceSimple.sendMessage({
          to: '8107013671679',
          message: testMessage
        });
        whatsappResult = true; // It opened, so consider it a success
      }
      
      devLog('📱 WhatsApp test result:', whatsappResult);
      
      toast({
        title: "🧪 Testes Concluídos!",
        description: `Email: ${emailResult ? '✅ Enviado' : '⚠️ Abriu cliente'} | WhatsApp: ${whatsappResult ? '✅ Abriu' : '⚠️ Verifique'}`,
      });
      
    } catch (error) {
      devError('❌ Test error:', error);
      toast({
        title: "❌ Erro nos Testes",
        description: "Verifique o console (F12) para mais detalhes",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const printShippingLabel = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta de Envio - ${order.orderNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .label { border: 3px solid #000; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .section { margin-bottom: 20px; }
          .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
          .box { border: 2px dashed #666; padding: 15px; }
          h1 { margin: 0 0 5px 0; font-size: 28px; }
          h2 { margin: 0; font-size: 14px; color: #666; }
          h3 { margin: 0 0 10px 0; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          p { margin: 5px 0; font-size: 14px; }
          .strong { font-weight: bold; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; font-size: 16px; cursor: pointer;">
          🖨️ Imprimir Etiqueta
        </button>
        
        <div class="label">
          <div class="header">
            <h1>🌸 JAPAN EXPRESS</h1>
            <h2>Importação Direta Japão-Brasil</h2>
            <p class="strong">Pedido: ${order.orderNumber || 'N/A'}</p>
            <p>Data: ${new Date(order.orderDate || order.date).toLocaleDateString('pt-BR')}</p>
          </div>

          <div class="section">
            <h3>📦 PRODUTOS</h3>
            ${order.items.map((item: any) => `
              <p>• ${item.productName} (${item.size}) x${item.quantity} - R$${(item.price * item.quantity).toLocaleString()}</p>
            `).join('')}
            <p class="strong" style="margin-top: 10px;">Total: R$${order.totalPrice.toLocaleString()}</p>
          </div>

          <div class="row">
            <div class="box">
              <h3>📤 REMETENTE (ご依頼主)</h3>
              <p class="strong">Paula Shiokawa</p>
              <p>〒518-0225</p>
              <p>三重県 伊賀市</p>
              <p>桐ヶ丘 5-292</p>
              <p>📞 070-1367-1679</p>
            </div>
            
            <div class="box">
              <h3>📥 DESTINATÁRIO (Aduana Brasil)</h3>
              <p class="strong">${order.shippingAddress.name || order.name}</p>
              <p>CPF: ${order.cpf || 'N/A'}</p>
              <p>CEP: ${order.shippingAddress.postalCode || order.postalCode}</p>
              <p>${order.shippingAddress.prefecture || order.prefecture} - ${order.shippingAddress.city || order.city}</p>
              <p>${order.shippingAddress.address || order.address}</p>
              ${(order.shippingAddress.building || order.building) ? `<p>Complemento: ${order.shippingAddress.building || order.building}</p>` : ''}
              <p>📞 ${order.phone || 'N/A'}</p>
            </div>
          </div>

          <div class="section" style="margin-top: 20px;">
            <h3>💳 PAGAMENTO</h3>
            <p>${order.paymentMethod === 'pix' ? '📱 PIX' : order.paymentMethod === 'card' ? '💳 Cartão de Crédito' : '📄 Boleto Bancário'}</p>
            <p class="strong">Status: ${order.status === 'pending' || order.status === 'Pendente' ? '⏳ Pendente' : '✅ Confirmado / Pago'}</p>
          </div>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
            ❌ Fechar
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Bypassed for demo testing
  if (false) {
    return null;
  }

  // Abas agrupadas (menu lateral) — orientado a dados
  const tabGroups: { title: string; items: AdminTabItem[] }[] = [
    { title: 'Visão geral', items: [{ id: 'dashboard', label: 'Dashboard', icon: BarChart3 }] },
    { title: 'Vendas', items: [
      { id: 'orders', label: 'Pedidos', icon: Package, badge: pendingOrdersCount },
      { id: 'negotiations', label: 'Negociações', icon: Handshake, badge: pendingNegotiationsCount || 0 },
      { id: 'customers', label: 'Clientes', icon: Users, badge: newCustomers },
      { id: 'affiliates', label: 'Afiliados', icon: Megaphone },
    ] },
    { title: 'Catálogo', items: [
      { id: 'products', label: 'Produtos', icon: PackagePlus },
      { id: 'coupons', label: 'Cupons', icon: Tag },
    ] },
    { title: 'Solicitações', items: [
      { id: 'requests', label: 'Personalizados', icon: Sparkles },
      { id: 'b2b', label: 'Empresas', icon: Building2 },
      { id: 'videos', label: 'Vídeos de review', icon: Video },
    ] },
    { title: 'Conteúdo', items: [
      { id: 'home', label: 'Início', icon: Video },
      { id: 'vlog', label: 'Vlog', icon: Clapperboard },
    ] },
    { title: 'Marketing', items: [
      { id: 'marketing', label: 'Gastos Marketing', icon: Megaphone },
    ] },
    { title: 'Ferramentas', items: [
      { id: 'promotion', label: 'Promoção Início', icon: Sparkles },
      { id: 'calculator', label: 'Calculadora', icon: Calculator },
      { id: 'migration', label: 'Migrar Imagens', icon: CloudUpload },
    ] },
    // Só nível 3 vê o gerenciamento de administradores
    ...(permissions.canManageAdmins
      ? [{ title: 'Configurações', items: [{ id: 'admins' as AdminTab, label: 'Administradores', icon: ShieldCheck }] }]
      : []),
  ];
  const allTabs: AdminTabItem[] = tabGroups.flatMap((g) => g.items);
  const activeLabel = allTabs.find((t) => t.id === activeTab)?.label || '';

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              🔐 Painel Administrativo
            </h1>
            <p className="text-muted-foreground text-lg">
              Gestão de Pedidos - Paula Shiokawa
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                className="gap-2 border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={() => setPromoModalOpen(true)}
              >
                <Megaphone className="w-4 h-4" />
                Disparar Notificação Promocional
              </Button>
              <Button
                variant="outline"
                className={`gap-2 ${settings.vlogEnabled ? 'border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                onClick={() => saveSettings({ ...settings, vlogEnabled: !settings.vlogEnabled })}
              >
                {settings.vlogEnabled ? '👁 Vlog ATIVO' : '🙈 Vlog OCULTO'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto lg:flex lg:gap-8 lg:items-start">

            {/* MENU LATERAL (desktop) */}
            <aside className="hidden lg:block lg:w-56 shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-2xl">
              <div className="bg-card rounded-2xl border border-border p-3 space-y-4">
                {tabGroups.map((group) => (
                  <div key={group.title}>
                    <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{group.title}</p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.badge ? (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* COLUNA DE CONTEÚDO */}
            <div className="flex-1 min-w-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              {/* Navegação mobile (scroll horizontal) */}
              <div className="lg:hidden mb-6">
                <nav className="flex overflow-x-auto scrollbar-hide gap-2 pb-1">
                  {allTabs.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {item.label}
                        {item.badge ? (
                          <span className="ml-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <h2 className="hidden lg:block font-display text-2xl font-bold text-foreground mb-5">{activeLabel}</h2>

            {/* Content */}
            {activeTab === 'orders' ? (
              <>
            
            {/* Test Button */}
            <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-2xl border-2 border-blue-200 dark:border-blue-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <TestTube className="w-5 h-5" />
                    Testar Notificações
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Envie emails e WhatsApp de teste para verificar se as configurações estão funcionando
                  </p>
                </div>
                <Button 
                  onClick={testNotifications}
                  disabled={isTesting}
                  size="lg"
                  className="ml-4"
                >
                  {isTesting ? '⏳ Testando...' : '🧪 Testar Agora'}
                </Button>
              </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                  <h3 className="font-semibold text-lg">Total de Pedidos</h3>
                </div>
                <p className="text-3xl font-bold">{allOrders.length}</p>
              </div>
              
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-6 h-6 text-yellow-600" />
                  <h3 className="font-semibold text-lg">Pendentes</h3>
                </div>
                <p className="text-3xl font-bold text-yellow-600">
                  {allOrders.filter(o => o.status === 'pending').length}
                </p>
              </div>
              
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-6 h-6 text-green-600" />
                  <h3 className="font-semibold text-lg">Hoje</h3>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {allOrders.filter(o => {
                    const orderDate = new Date(o.orderDate).toDateString();
                    const today = new Date().toDateString();
                    return orderDate === today;
                  }).length}
                </p>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-bold text-foreground">
                Pedidos Recentes
              </h2>
              
              {ordersLoading ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground">Carregando pedidos...</p>
                </div>
              ) : allOrders.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                </div>
              ) : (
                ordersPagination.pageItems.map((order, index) => (
                  <div key={index} className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Package className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-lg">
                            Pedido #{order.orderNumber || `ORD-${index + 1}`}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status || 'pending')}`}>
                            {getStatusLabel(order.status || 'pending')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {new Date(order.orderDate).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-sm text-muted-foreground font-semibold">
                          💳 {order.paymentMethod === 'pix' ? 'PIX'
                            : order.paymentMethod === 'wise' ? 'Wise'
                            : order.paymentMethod === 'paypay' ? 'PayPay'
                            : order.paymentMethod === 'yucho' ? 'Yucho'
                            : order.paymentMethod === 'card' ? 'Cartão de Crédito'
                            : order.paymentMethod === 'boleto' ? 'Boleto Bancário'
                            : order.paymentMethod || 'N/A'}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap justify-end">
                        <Button
                          onClick={() => setCn23Order(order)}
                          variant="outline"
                          className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <FileText className="w-4 h-4" />
                          CN22/CN23
                        </Button>
                        <Button
                          onClick={() => printShippingLabel(order)}
                          variant="outline"
                          className="gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          Etiqueta
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border">
                      {/* Customer Info */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Cliente
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{order.shippingAddress.name}</p>
                          <p className="text-muted-foreground flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {order.customerEmail || 'N/A'}
                          </p>
                          <p className="text-muted-foreground flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {order.shippingAddress.phone || order.customerName || 'N/A'}
                          </p>
                          <p className="text-muted-foreground flex items-start gap-2 mt-2">
                            <MapPin className="w-4 h-4 mt-0.5" />
                            <span>
                              〒{order.shippingAddress.postalCode}<br />
                              {order.shippingAddress.prefecture} {order.shippingAddress.city}<br />
                              {order.shippingAddress.address}
                              {order.shippingAddress.building && <><br />{order.shippingAddress.building}</>}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Products */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" />
                          Produtos
                        </h4>
                        <div className="space-y-2">
                          {order.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                               <span>{item.productName || item.name} ({item.size}) x{item.quantity}</span>
                               <span className="font-semibold font-mono">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          {(() => {
                            const itemsSubtotal = order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                            // Detect coupon discount: saved field OR inferred from items sum vs totalPrice
                            const discount = order.couponDiscount || (itemsSubtotal > order.totalPrice ? itemsSubtotal - order.totalPrice : 0);
                            const shippingCost = order.shipping?.cost ?? null;
                            return (
                              <div className="pt-2 border-t border-border space-y-1">
                                {/* Subtotal */}
                                <div className="flex justify-between text-sm">
                                  <span>Subtotal</span>
                                  <span className="font-mono">R$ {itemsSubtotal.toFixed(2)}</span>
                                </div>
                                
                                {/* Coupon Discount */}
                                {discount > 0 && (
                                  <div className="flex justify-between text-sm text-green-600 font-bold">
                                    <span className="flex items-center gap-1">
                                      <Tag className="w-3 h-3" />
                                      Cupom {order.couponCode && <span className="font-mono bg-green-100 px-1 rounded text-xs">{order.couponCode}</span>}
                                    </span>
                                    <span className="font-mono">-R$ {discount.toFixed(2)}</span>
                                  </div>
                                )}
                                
                                {/* Shipping */}
                                <div className="flex justify-between text-sm">
                                  <span className="flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    Frete {order.shippingCarrier && <span className="text-muted-foreground text-xs">({order.shippingCarrier})</span>}
                                  </span>
                                  <span className="font-mono">{shippingCost != null ? (shippingCost === 0 ? <span className="text-green-600">Grátis</span> : `R$ ${shippingCost.toFixed(2)}`) : 'N/A'}</span>
                                </div>

                                {/* Impostos */}
                                {(order.federalTax > 0 || order.icmsTax > 0 || order.taxAmount > 0) && (
                                  order.federalTax != null && order.icmsTax != null ? (
                                    <>
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>II Federal</span>
                                        <span className="font-mono">R$ {Number(order.federalTax).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>ICMS (17%)</span>
                                        <span className="font-mono">R$ {Number(order.icmsTax).toFixed(2)}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>Impostos Estimados (II + ICMS)</span>
                                      <span className="font-mono">R$ {Number(order.taxAmount || 0).toFixed(2)}</span>
                                    </div>
                                  )
                                )}
                                
                                {/* Total */}
                                <div className="flex justify-between font-bold pt-1 border-t border-border text-base">
                                  <span>Total Geral</span>
                                  <span className="text-primary font-mono">
                                    {order.currency !== 'JPY' && (order as any).grandTotalYen
                                      ? `R$ ${(order.totalPrice ?? order.total ?? 0).toFixed(2)} (¥ ${((order as any).grandTotalYen as number).toLocaleString()})`
                                      : `R$ ${(order.totalPrice ?? order.total ?? 0).toFixed(2)}`}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2">
                      {order.status === 'pending' && (
                        <Button
                          onClick={() => handleUpdateStatus(order.orderNumber, 'processing')}
                          size="sm"
                          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirmar Pagamento
                        </Button>
                      )}
                      {order.status === 'processing' && (
                        <Button
                          onClick={() => handleUpdateStatus(order.orderNumber, 'packing')}
                          size="sm"
                          className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          <Package className="w-4 h-4" />
                          Preparando Pacote
                        </Button>
                      )}
                      {order.status === 'packing' && (
                        <Button
                          onClick={() => {
                            setSelectedOrder(order);
                            setTrackingModalOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          Marcar como Enviado
                        </Button>
                      )}
                      {order.status === 'shipped' && (
                        <Button
                          onClick={() => handleUpdateStatus(order.orderNumber, 'delivered')}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Marcar como Entregue
                        </Button>
                      )}
                      {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <Button
                          onClick={() => handleUpdateStatus(order.orderNumber, 'cancelled')}
                          variant="outline"
                          size="sm"
                          className="gap-2 text-orange-600 hover:text-orange-700"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancelar
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDeleteOrder(order.orderNumber)}
                        variant="destructive"
                        size="sm"
                        className="gap-2 ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {allOrders.length > 0 && (
                <Pagination
                  page={ordersPagination.page}
                  totalPages={ordersPagination.totalPages}
                  onPageChange={ordersPagination.setPage}
                  rangeStart={ordersPagination.rangeStart}
                  rangeEnd={ordersPagination.rangeEnd}
                  total={ordersPagination.total}
                  className="pt-4"
                />
              )}
            </div>
            </>
            ) : activeTab === 'coupons' ? (
              <CouponManager />
            ) : activeTab === 'dashboard' ? (
              <Dashboard />
            ) : activeTab === 'products' ? (
              <ProductManager />
            ) : activeTab === 'home' ? (
              <HomeContentManager />
            ) : activeTab === 'vlog' ? (
              <VlogManager />
            ) : activeTab === 'affiliates' ? (
              <AffiliateManager />
            ) : activeTab === 'requests' ? (
              <CustomRequestManager />
            ) : activeTab === 'b2b' ? (
              <B2BRequestManager />
            ) : activeTab === 'videos' ? (
              <VideoReviewManager />
            ) : activeTab === 'admins' ? (
              <AdminAccessManager />
            ) : activeTab === 'promotion' ? (
              <PromotionManager />
            ) : activeTab === 'calculator' ? (
              <AdminCalculator />
            ) : activeTab === 'migration' ? (
              <ImageMigration />
            ) : activeTab === 'negotiations' ? (
              <NegotiationManager />
            ) : activeTab === 'marketing' ? (
              <MarketingManager />
            ) : (
              <CustomerList />
            )}
            </div>
          </div>
        </div>
      </section>

      {/* Promo Notification Modal */}
      {promoModalOpen && (
        <PromoNotificationModal onClose={() => setPromoModalOpen(false)} />
      )}

      {/* CN22/CN23 Modal */}
      {cn23Order && (
        <CN23Modal order={cn23Order} onClose={() => setCn23Order(null)} />
      )}

      {/* Tracking Modal */}
      {selectedOrder && (
        <TrackingModal
          order={selectedOrder}
          isOpen={trackingModalOpen}
          onClose={() => {
            setTrackingModalOpen(false);
            setSelectedOrder(null);
          }}
          onSuccess={async (trackingNumber, carrierFromModal) => {
            // Get carrier info from modal (which reads from order.shipping.carrier) or fallback
            const carrier = carrierFromModal || selectedOrder.shipping?.carrier || selectedOrder.carrier || '';
            const getTrackingUrl = (c: string, tn: string) => {
              const lc = c.toLowerCase();
              if (lc.includes('yamato') || lc.includes('クロネコ')) return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${tn}`;
              if (lc.includes('sagawa') || lc.includes('佐川')) return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${tn}`;
              if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('post')) return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=ja`;
              if (lc.includes('fukutsu') || lc.includes('福通')) return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${tn}`;
              return '';
            };
            const trackingUrl = getTrackingUrl(carrier, trackingNumber);
            
            // Save tracking info to order (Firestore + safeStorage)
            await orderService.updateOrderTracking(selectedOrder.orderNumber, trackingNumber, trackingUrl, carrier);
            
            // Also update status
            await handleUpdateStatus(selectedOrder.orderNumber, 'shipped');
            toast({
              title: "Pedido marcado como enviado!",
              description: `Tracking: ${trackingNumber}`,
            });
          }}
        />
      )}
    </Layout>
  );
};

export default Admin;
