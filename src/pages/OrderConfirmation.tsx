import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Smartphone, Home, Mail } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { emailService } from '@/services/emailService';
import { paypayService } from '@/services/paypayService';
import { carrierService } from '@/services/carrierService';
import type { OrderData, CartItem } from '@/types/order';

const OrderConfirmation: React.FC = () => {
  const { clearCart } = useCart();
  const { addOrder, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const orderData = location.state;
  
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [emailSent, setEmailSent] = useState(false);
  
  // Use ref to prevent processing the order multiple times
  const processedRef = useRef(false);

  useEffect(() => {
    if (!orderData) {
      navigate('/');
      return;
    }

    // Prevent processing order multiple times
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

    // Clear cart
    clearCart();

    // Save order to user's history if authenticated
    if (isAuthenticated) {
      addOrder({
        items: orderData.items.map((item: CartItem) => ({
          productName: item.product.name,
          size: item.size,
          quantity: item.quantity,
          price: item.product.prices[item.size],
        })),
        totalAmount: orderData.totalPrice,
        paymentMethod: orderData.paymentMethod,
        status: 'pending',
        shippingAddress: {
          name: orderData.formData.name,
          postalCode: orderData.formData.postalCode,
          prefecture: orderData.formData.prefecture,
          city: orderData.formData.city,
          address: orderData.formData.address,
          building: orderData.formData.building,
        }
      });
    }

    // Show success notification
    toast({
      title: "🎉 Pedido Confirmado!",
      description: "Seu pedido foi realizado com sucesso. Você receberá uma confirmação por email e WhatsApp.",
    });

    // Send notifications and create shipping label
    sendNotifications(orderData);
  }, [orderData, clearCart, navigate, toast, addOrder, isAuthenticated]);

  const sendNotifications = async (data: OrderData) => {
    const orderNumber = `DL-${Date.now().toString().slice(-8)}`;
    const shipping = data.shipping || { carrier: 'N/A', cost: 0, estimatedDays: 'N/A' };
    let generatedTrackingNumber = '';
    
    // 1. Create Shipping Label via Carrier API (FIRST - to get tracking number)
    try {
      const labelData = {
        orderNumber,
        sender: {
          name: 'Paula Shiokawa',
          postalCode: '518-0225',
          address: 'Mie-ken Iga-shi Kirigaoka 5-292',
          phone: '070-1367-1679'
        },
        recipient: {
          name: data.formData.name,
          postalCode: data.formData.postalCode,
          prefecture: data.formData.prefecture,
          city: data.formData.city,
          address: data.formData.address,
          building: data.formData.building,
          phone: data.formData.phone
        },
        items: data.items.map((item: CartItem) => ({
          name: item.product.name,
          quantity: item.quantity,
          weight: item.size === '800g' ? 800 : 280
        })),
        deliveryTime: data.deliveryTime
      };
      
      const tracking = await carrierService.createLabel(shipping.carrier, labelData);
      generatedTrackingNumber = tracking.trackingNumber;
      setTrackingNumber(generatedTrackingNumber);
      
      console.log('📦 Shipping label created');
      console.log('🔢 Tracking number:', generatedTrackingNumber);
    } catch (error) {
      console.error('Error creating shipping label:', error);
    }
    
    // 2. Send Email (WITH tracking number and shipping label)
    try {
      const emailHTML = emailService.generateOrderEmailHTML({
        ...data,
        orderNumber
      }, generatedTrackingNumber);
      
      const emailResult = await emailService.sendOrderConfirmation({
        to: data.formData.email,
        subject: `Confirmação de Pedido ${orderNumber} - Doce de Leite`,
        html: emailHTML,
        orderNumber,
        customerName: data.formData.name,
        trackingNumber: generatedTrackingNumber
      });
      
      setEmailSent(emailResult);
      console.log('📧 Email sent to:', data.formData.email, emailResult ? '✅' : '⏳');
      console.log('📧 Email includes: Order details, shipping label with QR code, tracking number');
    } catch (error) {
      console.error('Error sending email:', error);
    }
    
    // 3. PayPay Integration (if PayPay payment selected)
    if (data.paymentMethod === 'paypay') {
      try {
        const paymentResult = await paypayService.createPayment({
          orderNumber,
          amount: (data.totalPrice || 0) + (shipping.cost || 0),
          description: `Pedido Doce de Leite ${orderNumber}`,
          customerEmail: data.formData.email,
          customerPhone: data.formData.phone
        });
        
        if (paymentResult.success && paymentResult.paymentUrl) {
          console.log('💳 PayPay payment URL:', paymentResult.paymentUrl);
          console.log('📱 PayPay QR Code:', paymentResult.qrCodeUrl);
        }
      } catch (error) {
        console.error('Error creating PayPay payment:', error);
      }
    }
    
    // 4. WhatsApp Message (to store owner)
    const whatsappMessage = `
🎉 *NOVO PEDIDO - Doce de Leite*

📋 *Pedido:* ${orderNumber}
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}
${generatedTrackingNumber ? `🔢 *Rastreamento:* ${generatedTrackingNumber}\n` : ''}

👤 *Cliente:*
Nome: ${data.formData.name}
Tel: ${data.formData.phone}
Email: ${data.formData.email}

📍 *Endereço de Entrega:*
〒${data.formData.postalCode}
${data.formData.prefecture} ${data.formData.city}
${data.formData.address}
${data.formData.building ? data.formData.building : ''}

📦 *Produtos:*
${data.items.map((item: CartItem) => 
  `• ${item.product.name} (${item.size}) x${item.quantity} - ¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}`
).join('\n')}

💰 *Valores:*
Subtotal: ¥${data.totalPrice.toLocaleString()}
Frete (${shipping.carrier}): ¥${shipping.cost.toLocaleString()}
*Total: ¥${(data.totalPrice + shipping.cost).toLocaleString()}*

🚚 *Frete:*
Transportadora: ${shipping.carrier}
Previsão: ${shipping.estimatedDays} dias úteis

💳 *Pagamento:*
${data.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}
    `.trim();
    
    console.log('📱 WhatsApp to: 070-1367-1679');
    console.log('📱 WhatsApp Message:\n', whatsappMessage);
  };

  if (!orderData) {
    return null;
  }

  const { formData, paymentMethod, items, totalPrice, shipping } = orderData;
  const orderNumber = `DL-${Date.now().toString().slice(-8)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <section className="py-12 bg-background min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            
            {/* Success Message */}
            <div className="text-center mb-8 print:hidden">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="font-display text-4xl font-bold text-foreground mb-2">
                Pedido Confirmado!
              </h1>
              <p className="text-lg text-muted-foreground mb-2">
                Número do pedido: <span className="font-mono font-semibold text-foreground">{orderNumber}</span>
              </p>
              <p className="text-muted-foreground">
                Obrigado por sua compra! Seu pedido está sendo processado.
              </p>
            </div>

            {/* Notification Status */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-6 print:hidden">
              <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                Notificações Enviadas
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Email de confirmação enviado</p>
                    <p className="text-muted-foreground">{formData.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">WhatsApp enviado para a loja</p>
                    <p className="text-muted-foreground">070-1367-1679</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary for Print */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-6">
              <div className="text-center mb-6 print:block hidden">
                <h1 className="font-display text-3xl font-bold mb-2">Doce de Leite</h1>
                <p className="text-muted-foreground">Recibo de Pedido</p>
                <p className="font-mono text-sm">Pedido: {orderNumber}</p>
                <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>

              <div className="space-y-6">
                {/* Customer Info */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Dados do Cliente</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nome:</p>
                      <p className="font-medium">{formData.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Telefone:</p>
                      <p className="font-medium">{formData.phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Email:</p>
                      <p className="font-medium">{formData.email}</p>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Endereço de Entrega</h3>
                  <div className="text-sm">
                    <p>〒{formData.postalCode}</p>
                    <p>{formData.prefecture} {formData.city}</p>
                    <p>{formData.address}</p>
                    {formData.building && <p>{formData.building}</p>}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Produtos</h3>
                  <div className="space-y-2">
                    {items.map((item: CartItem) => (
                      <div key={`${item.product.id}-${item.size}`} className="flex justify-between text-sm border-b pb-2">
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-muted-foreground">{item.size} × {item.quantity}</p>
                        </div>
                        <p className="font-medium">¥{(item.product.prices[item.size] * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Info */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Pagamento e Frete</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método de Pagamento:</span>
                      <span className="font-medium">
                        {paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">¥{totalPrice.toLocaleString()}</span>
                    </div>
                    {shipping && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frete ({shipping.carrier}):</span>
                          <span className="font-medium">¥{shipping.cost.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          Previsão: {shipping.estimatedDays} dias úteis
                        </div>
                      </>
                    )}
                    {!shipping && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frete:</span>
                        <span className="font-medium">A calcular</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-primary">
                        ¥{shipping ? (totalPrice + shipping.cost).toLocaleString() : `${totalPrice.toLocaleString()}+`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Instructions */}
                {paymentMethod === 'bank' && (
                  <div className="bg-secondary/50 p-4 rounded-lg print:break-inside-avoid">
                    <h4 className="font-semibold mb-2">Instruções de Pagamento</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Por favor, realize o depósito bancário para:
                    </p>
                    <div className="text-sm space-y-1 font-mono">
                      <p>Banco: [Nome do Banco]</p>
                      <p>Agência: [Número da Agência]</p>
                      <p>Conta: [Número da Conta]</p>
                      <p>Nome: Paula Shiokawa</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      * Envie o comprovante via WhatsApp: 070-1367-1679
                    </p>
                  </div>
                )}

                {paymentMethod === 'paypay' && (
                  <div className="bg-secondary/50 p-4 rounded-lg print:break-inside-avoid">
                    <h4 className="font-semibold mb-2">Instruções PayPay</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Envie o pagamento via PayPay para:
                    </p>
                    <p className="text-lg font-semibold">070-1367-1679</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      * Após o pagamento, envie a confirmação via WhatsApp
                    </p>
                  </div>
                )}

                {/* Sender Info for Shipping Label */}
                <div className="print:block hidden print:break-before-page">
                  <h3 className="font-semibold text-lg mb-3">Etiqueta de Envio</h3>
                  <div className="grid grid-cols-2 gap-4 border-2 border-dashed border-border p-4">
                    <div>
                      <p className="font-semibold mb-2">REMETENTE:</p>
                      <p className="text-sm">Paula Shiokawa</p>
                      <p className="text-sm">〒518-0225</p>
                      <p className="text-sm">三重県 伊賀市</p>
                      <p className="text-sm">桐ヶ丘 5-292</p>
                      <p className="text-sm">Tel: 070-1367-1679</p>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">DESTINATÁRIO:</p>
                      <p className="text-sm">{formData.name}</p>
                      <p className="text-sm">〒{formData.postalCode}</p>
                      <p className="text-sm">{formData.prefecture} {formData.city}</p>
                      <p className="text-sm">{formData.address}</p>
                      {formData.building && <p className="text-sm">{formData.building}</p>}
                      <p className="text-sm">Tel: {formData.phone}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 print:hidden">
              <Button 
                variant="outline" 
                onClick={handlePrint}
                className="flex-1 rounded-xl py-6 text-lg gap-2"
              >
                <Printer className="w-5 h-5" />
                Imprimir Recibo
              </Button>
              <Button 
                onClick={() => navigate('/')}
                className="flex-1 btn-primary rounded-xl py-6 text-lg font-semibold gap-2"
              >
                <Home className="w-5 h-5" />
                Voltar ao Início
              </Button>
            </div>

            {/* Next Steps */}
            <div className="mt-8 bg-secondary/30 rounded-xl p-6 print:hidden">
              <h3 className="font-semibold text-lg mb-3">Próximos Passos</h3>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Realize o pagamento conforme as instruções acima</li>
                <li>Envie o comprovante via WhatsApp (070-1367-1679)</li>
                <li>Aguarde a confirmação do pagamento</li>
                <li>Seu pedido será enviado em até 2 dias úteis</li>
                <li>Você receberá o código de rastreamento por email</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </Layout>
  );
};

export default OrderConfirmation;
