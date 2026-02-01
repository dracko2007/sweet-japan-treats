import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Printer, ShoppingBag, User, MapPin, Phone, Mail, Calendar, TestTube, Tag, Truck, CheckCircle, XCircle, Trash2, BarChart3 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { emailService } from '@/services/emailService';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { whatsappService } from '@/services/whatsappService';
import { whatsappServiceSimple } from '@/services/whatsappServiceSimple';
import { useToast } from '@/hooks/use-toast';
import CouponManager from '@/components/admin/CouponManager';
import Dashboard from '@/components/admin/Dashboard';
import { orderService } from '@/services/orderService';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { toast } = useToast();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'coupons' | 'dashboard'>('orders');

  // Admin email - apenas Paula pode acessar
  const ADMIN_EMAIL = 'dracko2007@gmail.com';

  useEffect(() => {
    // Verifica se é admin
    if (!user || user.email !== ADMIN_EMAIL) {
      navigate('/');
      return;
    }

    loadOrders();
  }, [user, navigate]);

  const loadOrders = () => {
    const orders = orderService.getAllOrders();
    setAllOrders(orders);
  };

  const handleUpdateStatus = (orderNumber: string, newStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled') => {
    const success = orderService.updateOrderStatus(orderNumber, newStatus);
    
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

  const handleDeleteOrder = (orderNumber: string) => {
    if (!confirm(`Tem certeza que deseja excluir o pedido ${orderNumber}?`)) {
      return;
    }

    const success = orderService.deleteOrder(orderNumber);
    
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
      pending: 'Pendente',
      processing: 'Processando',
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
      shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Test notification services
  const testNotifications = async () => {
    setIsTesting(true);
    console.log('🧪 Starting notification tests...');
    
    try {
      // Test Email
      console.log('📧 Testing email service...');
      
      let emailResult = false;
      
      // Try Resend first
      if (import.meta.env.VITE_RESEND_API_KEY) {
        console.log('📧 Testing Resend...');
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
        console.log('📧 Testing EmailJS...');
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
      
      console.log('📧 Email test result:', emailResult);
      
      // Wait a bit before WhatsApp test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test WhatsApp
      console.log('📱 Testing WhatsApp service...');
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
        console.log('📱 Testing Twilio...');
        whatsappResult = await whatsappService.sendMessage({
          to: '+8107013671679',
          message: testMessage
        });
      } else {
        // Use simple WhatsApp (always works)
        console.log('📱 Testing Simple WhatsApp (opens directly)...');
        whatsappServiceSimple.sendMessage({
          to: '8107013671679',
          message: testMessage
        });
        whatsappResult = true; // It opened, so consider it a success
      }
      
      console.log('📱 WhatsApp test result:', whatsappResult);
      
      toast({
        title: "🧪 Testes Concluídos!",
        description: `Email: ${emailResult ? '✅ Enviado' : '⚠️ Abriu cliente'} | WhatsApp: ${whatsappResult ? '✅ Abriu' : '⚠️ Verifique'}`,
      });
      
    } catch (error) {
      console.error('❌ Test error:', error);
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
            <h1>🍮 SABOR DO CAMPO</h1>
            <h2>Doce de Leite Artesanal</h2>
            <p class="strong">Pedido: ${order.orderNumber || 'N/A'}</p>
            <p>Data: ${new Date(order.date).toLocaleDateString('pt-BR')}</p>
          </div>

          <div class="section">
            <h3>📦 PRODUTOS</h3>
            ${order.items.map((item: any) => `
              <p>• ${item.productName} (${item.size}) x${item.quantity} - ¥${(item.price * item.quantity).toLocaleString()}</p>
            `).join('')}
            <p class="strong" style="margin-top: 10px;">Total: ¥${order.totalAmount.toLocaleString()}</p>
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
              <h3>📥 DESTINATÁRIO (お届け先)</h3>
              <p class="strong">${order.shippingAddress.name}</p>
              <p>〒${order.shippingAddress.postalCode}</p>
              <p>${order.shippingAddress.prefecture}</p>
              <p>${order.shippingAddress.city}</p>
              <p>${order.shippingAddress.address}</p>
              ${order.shippingAddress.building ? `<p>${order.shippingAddress.building}</p>` : ''}
              <p>📞 ${order.customerData?.phone || 'N/A'}</p>
            </div>
          </div>

          <div class="section" style="margin-top: 20px;">
            <h3>💳 PAGAMENTO</h3>
            <p>${order.paymentMethod === 'bank' ? '🏦 Depósito Bancário' : '📱 PayPay'}</p>
            <p class="strong">Status: ${order.status === 'pending' ? '⏳ Pendente' : '✅ Confirmado'}</p>
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

  if (!user || user.email !== ADMIN_EMAIL) {
    return null;
  }

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
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            
            {/* Tabs */}
            <div className="mb-8">
              <div className="border-b border-border">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'orders'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                    }`}
                  >
                    <Package className="w-4 h-4 inline mr-2" />
                    Pedidos
                  </button>
                  <button
                    onClick={() => setActiveTab('coupons')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'coupons'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                    }`}
                  >
                    <Tag className="w-4 h-4 inline mr-2" />
                    Cupons de Desconto
                  </button>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'dashboard'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 inline mr-2" />
                    Dashboard
                  </button>
                </nav>
              </div>
            </div>

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
                    const orderDate = new Date(o.date).toDateString();
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
              
              {allOrders.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                </div>
              ) : (
                allOrders.map((order, index) => (
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
                          {new Date(order.date).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          💳 {order.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}
                        </p>
                      </div>
                      
                      <Button 
                        onClick={() => printShippingLabel(order)}
                        variant="outline"
                        className="gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir Etiqueta
                      </Button>
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
                              <span>{item.productName} ({item.size}) x{item.quantity}</span>
                              <span className="font-semibold">¥{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-border flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-primary">¥{order.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2">
                      {order.status === 'pending' && (
                        <Button
                          onClick={() => handleUpdateStatus(order.orderNumber, 'processing')}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Processar
                        </Button>
                      )}
                      {(order.status === 'pending' || order.status === 'processing') && (
                        <Button
                          onClick={() => handleUpdateStatus(order.orderNumber, 'shipped')}
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
            </div>
            </>
            ) : activeTab === 'coupons' ? (
              <CouponManager />
            ) : (
              <Dashboard />
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;
