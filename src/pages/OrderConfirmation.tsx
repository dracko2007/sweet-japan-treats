import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Home, Mail, Printer } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { emailService } from '@/services/emailService';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { carrierService } from '@/services/carrierService';
import { couponService } from '@/services/couponService';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import type { OrderData, CartItem } from '@/types/order';

const OrderConfirmation: React.FC = () => {
  const { clearCart } = useCart();
  const { addOrder, isAuthenticated, user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const orderData = location.state;
  
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string>('');
  
  // Use ref to prevent processing the order multiple times
  const processedRef = useRef(false);

  // Helper function to save order directly to localStorage (even if not logged in)
  const saveOrderToStorage = (email: string, orderData: any) => {
    console.log('🔍 [DEBUG] saveOrderToStorage called with email:', email);
    
    const usersData = localStorage.getItem('sweet-japan-users');
    console.log('🔍 [DEBUG] sweet-japan-users exists:', !!usersData);
    
    if (!usersData) {
      console.error('❌ [DEBUG] No users data in localStorage!');
      return;
    }
    
    const users = JSON.parse(usersData);
    console.log('🔍 [DEBUG] Total users in storage:', Object.keys(users).length);
    console.log('🔍 [DEBUG] User emails in storage:', Object.keys(users));
    
    // Find or create user entry
    if (!users[email]) {
      console.error('❌ [DEBUG] User not found with email:', email);
      console.log('🔍 [DEBUG] Available users:', Object.keys(users));
      return;
    }
    
    console.log('✅ [DEBUG] User found:', email);
    console.log('🔍 [DEBUG] User data:', users[email]);
    
    // Ensure orders array exists
    if (!users[email].orders) {
      console.log('🔍 [DEBUG] Initializing orders array for user');
      users[email].orders = [];
    }
    
    console.log('🔍 [DEBUG] Current orders count:', users[email].orders.length);
    
    // Add the order
    users[email].orders.unshift(orderData);
    console.log('🔍 [DEBUG] Order added, new count:', users[email].orders.length);
    console.log('🔍 [DEBUG] Order data:', orderData);
    
    localStorage.setItem('sweet-japan-users', JSON.stringify(users));
    console.log('✅ [DEBUG] Order saved to localStorage successfully!');
    
    // Verify save
    const verifyData = localStorage.getItem('sweet-japan-users');
    const verifyUsers = JSON.parse(verifyData!);
    console.log('✅ [DEBUG] Verification - orders count:', verifyUsers[email]?.orders?.length);
  };

  useEffect(() => {
    console.log('🔍 OrderConfirmation mounted');
    console.log('📦 location.state:', location.state);
    console.log('📦 orderData:', orderData);
    
    if (!orderData) {
      console.error('⚠️ No order data found in location.state');
      console.log('🔙 Redirecting to home...');
      navigate('/', { replace: true });
      return;
    }

    // Validate orderData structure
    if (!orderData.formData || !orderData.items || !orderData.totalPrice) {
      console.error('⚠️ Invalid order data structure:', {
        hasFormData: !!orderData.formData,
        hasItems: !!orderData.items,
        hasTotalPrice: !!orderData.totalPrice
      });
      navigate('/', { replace: true });
      return;
    }

    console.log('✅ Valid order data received:', {
      customerName: orderData.formData.name,
      itemsCount: orderData.items.length,
      total: orderData.totalPrice,
      paymentMethod: orderData.paymentMethod
    });

    // Prevent processing order multiple times
    if (processedRef.current) {
      console.log('✅ Order already processed, skipping');
      return;
    }
    processedRef.current = true;

    // Clear cart
    clearCart();

    // Save order to user's history
    const couponDiscount = orderData.couponDiscount || 0;
    const finalTotal = orderData.totalPrice - couponDiscount;
    const generatedOrderNumber = `DL-${Date.now().toString().slice(-8)}`;
    
    console.log('🔍 [DEBUG] ===== ORDER SAVE START =====');
    console.log('🔍 [DEBUG] Order number:', generatedOrderNumber);
    console.log('🔍 [DEBUG] Is authenticated:', isAuthenticated);
    console.log('🔍 [DEBUG] Current user:', user);
    console.log('🔍 [DEBUG] Form email:', orderData.formData.email);
    
    // Get customer email from form data or from logged in user
    const customerEmail = orderData.formData.email || user?.email;
    console.log('🔍 [DEBUG] Customer email to use:', customerEmail);
    
    if (customerEmail) {
      // Create order object
      const newOrder = {
        id: `order-${Date.now()}`,
        orderNumber: generatedOrderNumber,
        orderDate: new Date().toISOString(),
        date: new Date().toISOString(),
        items: orderData.items.map((item: CartItem) => ({
          productName: item.product.name,
          size: item.size,
          quantity: item.quantity,
          price: item.product.prices[item.size],
        })),
        totalAmount: finalTotal,
        totalPrice: finalTotal,
        paymentMethod: orderData.paymentMethod,
        status: 'pending' as const,
        shippingAddress: {
          name: orderData.formData.name,
          postalCode: orderData.formData.postalCode,
          prefecture: orderData.formData.prefecture,
          city: orderData.formData.city,
          address: orderData.formData.address,
          building: orderData.formData.building,
        },
        shipping: orderData.shipping,
        couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
        couponCode: (orderData.appliedCoupon || orderData.coupon)?.code || undefined,
        appliedCoupon: orderData.appliedCoupon || orderData.coupon || undefined,
        subtotal: orderData.totalPrice,
      };
      
      // Mark coupon as used by this user
      if ((orderData.appliedCoupon || orderData.coupon) && customerEmail) {
        const coupon = orderData.appliedCoupon || orderData.coupon;
        console.log('🎟️ [COUPON] Marking coupon as used:', coupon.code, 'by', customerEmail);
        couponService.useCoupon(coupon.code, customerEmail);
      }
      
      // Save to storage (works for logged in or guest users)
      saveOrderToStorage(customerEmail, newOrder);
      
      console.log('🔍 [DEBUG] ===== ORDER SAVE COMPLETE =====');
      
      // Also add to context if authenticated
      if (isAuthenticated) {
        console.log('🔍 [DEBUG] User is authenticated, also saving to context');
        addOrder({
          items: newOrder.items,
          totalAmount: finalTotal,
          paymentMethod: orderData.paymentMethod,
          status: 'pending',
          shippingAddress: newOrder.shippingAddress,
          shipping: orderData.shipping,
          orderNumber: generatedOrderNumber,
        });
      } else {
        // Guest user - sync directly to Firestore so ERP can see the order
        console.log('⚠️ [DEBUG] User NOT authenticated, syncing directly to Firestore');
        firebaseSyncService.syncOrderToFirestore('guest', {
          ...newOrder,
          orderDate: newOrder.date,
          totalPrice: finalTotal,
          customerEmail: customerEmail,
          customerName: orderData.formData.name,
          customerPhone: orderData.formData.phone,
        }).then(() => {
          console.log('✅ [DEBUG] Guest order synced to Firestore:', generatedOrderNumber);
        }).catch((err: any) => {
          console.error('❌ [DEBUG] Failed to sync guest order:', err);
        });
      }
    } else {
      console.error('❌ [DEBUG] No customer email available to save order');
      console.error('❌ [DEBUG] orderData.formData:', orderData.formData);
      console.error('❌ [DEBUG] user:', user);
    }

    // Show success notification
    toast({
      title: "🎉 Pedido Confirmado!",
      description: "Seu pedido foi realizado com sucesso. Você receberá uma confirmação por email.",
    });

    // Mark as loaded
    setIsLoading(false);

    // Send notifications and create shipping label
    sendNotifications(orderData, generatedOrderNumber);
  }, [orderData, clearCart, navigate, toast, addOrder, isAuthenticated]);

  const sendNotifications = async (data: OrderData, existingOrderNumber: string) => {
    const generatedOrderNumber = existingOrderNumber;
    setOrderNumber(generatedOrderNumber);
    const shipping = data.shipping || { carrier: 'N/A', cost: 0, estimatedDays: 'N/A' };
    const couponDiscount = data.couponDiscount || 0;
    const finalTotal = data.totalPrice - couponDiscount;
    let generatedTrackingNumber = '';
    
    // 1. Create Shipping Label via Carrier API (FIRST - to get tracking number)
    try {
      const labelData = {
        orderNumber: generatedOrderNumber,
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
    
    // 2. Send Emails using EmailJS
    try {
      console.log('📧 Sending emails via EmailJS...');
      
      // Send to customer
      const emailResultCustomer = await emailServiceSimple.sendOrderConfirmation({
        formData: data.formData,
        items: data.items,
        totalPrice: data.totalPrice,
        orderNumber: generatedOrderNumber,
        paymentMethod: data.paymentMethod,
        shipping: data.shipping
      });
      
      console.log('📧 Email sent to customer:', data.formData.email, emailResultCustomer ? '✅' : '❌');
      
      // Send to store owner (you) - using different template
      const emailResultStore = await emailServiceSimple.sendStoreNotification({
        formData: data.formData,
        items: data.items,
        totalPrice: data.totalPrice,
        orderNumber: generatedOrderNumber,
        paymentMethod: data.paymentMethod,
        shipping: data.shipping
      });
      
      console.log('📧 Store notification sent:', emailResultStore ? '✅' : '❌');
      setEmailSent(emailResultCustomer || emailResultStore);
      
    } catch (error) {
      console.error('❌ Error sending emails:', error);
    }
    
    // 3. WhatsApp Messages via local WhatsApp service (automatic)
    try {
      console.log('📱 Sending WhatsApp via local service (port 3001)...');
      
      const customerPhone = data.formData.phone;
      const itemsList = data.items.map((item: CartItem) => ({
        productName: item.product.name,
        size: item.size,
        quantity: item.quantity,
        price: item.product.prices[item.size],
      }));
      
      // Send confirmation to customer
      const customerResult = await fetch('http://localhost:3001/api/send-order-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customerPhone,
          orderNumber: generatedOrderNumber,
          customerName: data.formData.name,
          items: itemsList,
          total: finalTotal + (shipping.cost || 0),
          paymentMethod: data.paymentMethod,
          type: 'new_order',
          shipping: {
            cost: shipping.cost || 0,
            carrier: shipping.carrier || 'A definir',
          },
        }),
      });
      
      if (customerResult.ok) {
        console.log('✅ WhatsApp enviado ao cliente!');
      } else {
        const err = await customerResult.json();
        console.log('⚠️ WhatsApp cliente falhou:', err.error);
      }
      
      // Send notification to store owner (Paula)
      const storeResult = await fetch('http://localhost:3001/api/send-order-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '07013671679',
          orderNumber: generatedOrderNumber,
          customerName: data.formData.name,
          customerPhone: customerPhone,
          customerEmail: data.formData.email,
          items: itemsList,
          total: finalTotal + (shipping.cost || 0),
          paymentMethod: data.paymentMethod,
          type: 'new_order_store',
          shippingAddress: {
            postalCode: data.formData.postalCode,
            prefecture: data.formData.prefecture,
            city: data.formData.city,
            address: data.formData.address,
            building: data.formData.building,
          },
        }),
      });
      
      if (storeResult.ok) {
        console.log('✅ WhatsApp enviado para a loja!');
      } else {
        console.log('⚠️ WhatsApp loja falhou');
      }
      
    } catch (error) {
      // WhatsApp service not running - that's OK, emails were sent
      console.log('⚠️ Serviço WhatsApp não disponível (mensagens não enviadas):', error instanceof Error ? error.message : String(error));
    }
  };

  if (!orderData || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Processando pedido...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const { formData, paymentMethod, items, totalPrice, shipping } = orderData;
  const couponDiscount = orderData.couponDiscount || 0;
  const appliedCoupon = orderData.appliedCoupon;
  const finalTotal = totalPrice - couponDiscount;
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
                Notificação Enviada
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">Email de confirmação</p>
                  <p className="text-muted-foreground">{formData.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {emailSent ? '✅ Enviado com sucesso' : '⏳ O email será enviado automaticamente'}
                  </p>
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
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Desconto {appliedCoupon ? `(${appliedCoupon.code})` : ''}:</span>
                        <span className="font-medium">-¥{couponDiscount.toLocaleString()}</span>
                      </div>
                    )}
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
                        ¥{shipping ? (finalTotal + shipping.cost).toLocaleString() : `${finalTotal.toLocaleString()}+`}
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
                      <p>🏦 ゆうちょ銀行 (Japan Post Bank)</p>
                      <p>記号 (Kigou): <strong>12260</strong></p>
                      <p>番号 (Bangou): <strong>33664351</strong></p>
                      <p className="mt-2 pt-2 border-t border-border">📌 <strong>振込用 (Para transferência de outros bancos):</strong></p>
                      <p>金融機関コード: <strong>9900</strong></p>
                      <p>店名: <strong>二二八店 (228)</strong></p>
                      <p>口座番号: <strong>3366435</strong> (普通)</p>
                      <p>名義: <strong>ロドリゲス シオカワ ミリアン パウラ</strong></p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      * Envie o comprovante após o depósito via WhatsApp: 070-1367-1679
                    </p>
                  </div>
                )}

                {paymentMethod === 'paypay' && (
                  <div className="bg-secondary/50 p-4 rounded-lg print:break-inside-avoid">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-red-500 text-xl">●</span>
                      Pagamento via PayPay
                    </h4>
                    <div className="flex flex-col items-center gap-3 my-4">
                      <img 
                        src="/products/paypay-qr.png" 
                        alt="PayPay QR Code" 
                        className="w-48 h-48 rounded-lg border-2 border-red-400 shadow-md"
                      />
                      <p className="text-sm text-muted-foreground text-center">
                        Escaneie o QR Code com o app PayPay
                      </p>
                    </div>
                    <div className="bg-background/70 p-3 rounded-lg space-y-2">
                      <p className="text-sm font-medium">📱 Ou envie diretamente para:</p>
                      <p className="text-xl font-bold text-center tracking-wider">070-1367-1679</p>
                      <p className="text-xs text-center text-muted-foreground">Paula Shiokawa</p>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium">📝 Como pagar:</p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Abra o app <strong>PayPay</strong> no celular</li>
                        <li>Escaneie o QR Code acima ou busque pelo número</li>
                        <li>Insira o valor: <strong>¥{shipping ? (finalTotal + shipping.cost).toLocaleString() : finalTotal.toLocaleString()}</strong></li>
                        <li>Confirme o pagamento</li>
                        <li>Envie o comprovante via WhatsApp: 070-1367-1679</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Payment Info - Only visible when printed */}
                {paymentMethod === 'bank' && (
                  <div className="print:block hidden print:break-inside-avoid">
                    <h4 className="font-semibold mb-2">Dados Bancários</h4>
                    <div className="text-sm space-y-1 font-mono">
                      <p>ゆうちょ銀行 (Japan Post Bank)</p>
                      <p>記号: 12260 / 番号: 33664351</p>
                      <p>振込用: 店番228 / 口座3366435 (普通)</p>
                      <p>ロドリゲス シオカワ ミリアン パウラ</p>
                      <p>WhatsApp: 070-1367-1679</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 print:hidden">
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
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      ` }} />
    </Layout>
  );
};

export default OrderConfirmation;
