import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Printer, ShoppingBag, User, MapPin, Phone, Mail, Calendar } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [allOrders, setAllOrders] = useState<any[]>([]);

  // Admin email - apenas Paula pode acessar
  const ADMIN_EMAIL = 'dracko2007@gmail.com';

  useEffect(() => {
    // Verifica se é admin
    if (!user || user.email !== ADMIN_EMAIL) {
      navigate('/');
      return;
    }

    // Carrega todos os pedidos de todos os usuários
    const loadAllOrders = () => {
      const orders: any[] = [];
      
      // Percorre todos os items do localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('orders_')) {
          const userOrders = JSON.parse(localStorage.getItem(key) || '[]');
          const userId = key.replace('orders_', '');
          
          // Busca dados do usuário
          const users = JSON.parse(localStorage.getItem('users') || '[]');
          const userData = users.find((u: any) => u.id === userId);
          
          userOrders.forEach((order: any) => {
            orders.push({
              ...order,
              customerData: userData
            });
          });
        }
      }
      
      // Ordena por data (mais recente primeiro)
      orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllOrders(orders);
    };

    loadAllOrders();
  }, [user, navigate]);

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
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {order.status === 'pending' ? '⏳ Pendente' : '✅ Confirmado'}
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
                            {order.customerData?.email || 'N/A'}
                          </p>
                          <p className="text-muted-foreground flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {order.customerData?.phone || 'N/A'}
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;
