/**
 * Simple Email Service usando EmailJS
 * Envia emails direto do frontend sem precisar de backend
 * 
 * SETUP:
 * 1. Crie conta em https://www.emailjs.com/
 * 2. Configure um serviço de email (Gmail, Outlook, etc)
 * 3. Crie um template de email
 * 4. Adicione as credenciais no .env:
 *    - VITE_EMAILJS_SERVICE_ID
 *    - VITE_EMAILJS_TEMPLATE_ID
 *    - VITE_EMAILJS_PUBLIC_KEY
 */

import type { CartItem } from '@/types/order';
import { emailJsConfig } from '@/config/emailjs';
import { productEnglishName } from '@/utils/productName';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const getEmailJS = () => (window as any).emailjs;

const EMAILJS_SERVICE_ID = emailJsConfig.serviceId;
const EMAILJS_TEMPLATE_ID_CUSTOMER = emailJsConfig.templateIdCustomer;
const EMAILJS_TEMPLATE_ID_STORE = emailJsConfig.templateIdStore;
const EMAILJS_PUBLIC_KEY = emailJsConfig.publicKey;

// Load EmailJS library dynamically
let emailjsLoaded = false;
const loadEmailJS = (): Promise<void> => {
  if (emailjsLoaded || getEmailJS()) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = () => {
      emailjsLoaded = true;
      if (EMAILJS_PUBLIC_KEY) {
        (window as any).emailjs?.init(EMAILJS_PUBLIC_KEY);
      }
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

interface EmailParams {
  to_email: string;
  to_name: string;
  order_number: string;
  order_date: string;
  items_list: string;
  subtotal: string;
  discount?: string;
  shipping_cost: string;
  shipping_carrier: string;
  total_price: string;
  shipping_address: string;
  payment_method: string;
  phone: string;
}

export const emailServiceSimple = {
  /**
   * Send order confirmation email to customer
   */
  sendOrderConfirmation: async (orderData: any): Promise<boolean> => {
    devLog('📧 EmailJS - Sending order confirmation to customer');
    
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID_CUSTOMER || !EMAILJS_PUBLIC_KEY) {
      devError('❌ EmailJS NÃO configurado');
      return false;
    }
    
    try {
      await loadEmailJS();
      
      const itemsList = orderData.items.map((item: CartItem) => 
        `${productEnglishName(item.product as any)} (${item.size}) x${item.quantity} - ¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}`
      );
      
      const couponDiscount = orderData.couponDiscount || 0;
      const finalTotal = orderData.totalPrice - couponDiscount;
      const shipping = orderData.shipping || { carrier: 'N/A', cost: 0 };
      const paymentMethod = orderData.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay';
      
      // Generate full HTML email body
      const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#FF69B4 0%,#FFB6C1 100%);padding:40px 30px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600;">🌸 Japan Express</h1>
<p style="margin:10px 0 0 0;color:#f5e6d3;font-size:14px;letter-spacing:1px;">PRODUTOS IMPORTADOS DO JAPÃO</p>
</td></tr>

<!-- Success -->
<tr><td style="padding:40px 30px 20px 30px;text-align:center;">
<div style="display:inline-block;background-color:#dcfce7;border-radius:50%;width:60px;height:60px;line-height:60px;margin-bottom:20px;">
<span style="color:#16a34a;font-size:32px;">✓</span>
</div>
<h2 style="margin:0;color:#1a1a1a;font-size:24px;font-weight:600;">Pedido Confirmado!</h2>
<p style="margin:10px 0 0 0;color:#666666;font-size:16px;">Olá ${orderData.formData.name}, obrigado por sua compra! 🎉</p>
</td></tr>

<!-- Order Info -->
<tr><td style="padding:0 30px;">
<table width="100%" cellpadding="10" cellspacing="0" style="background-color:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb;">
<tr>
<td style="color:#666666;font-size:14px;padding:15px;">
<strong style="color:#1a1a1a;">📋 Número do Pedido:</strong><br>
<span style="font-family:monospace;font-size:16px;color:#FF69B4;">${orderData.orderNumber}</span>
</td>
<td style="color:#666666;font-size:14px;padding:15px;text-align:right;">
<strong style="color:#1a1a1a;">📅 Data:</strong><br>
<span style="font-size:16px;">${new Date().toLocaleDateString('pt-BR')}</span>
</td>
</tr>
</table>
</td></tr>

<!-- Products -->
<tr><td style="padding:30px;">
<h3 style="margin:0 0 15px 0;color:#1a1a1a;font-size:18px;font-weight:600;border-bottom:2px solid #FF69B4;padding-bottom:10px;">📦 Produtos</h3>
<div style="background-color:#ffffff;padding:15px;border:1px solid #e5e7eb;border-radius:8px;">
${itemsList.map((item: string) => `<p style="margin:5px 0;font-size:14px;color:#1a1a1a;">${item}</p>`).join('')}
</div>
</td></tr>

<!-- Pricing -->
<tr><td style="padding:0 30px 30px 30px;">
<table width="100%" cellpadding="8" cellspacing="0" style="background-color:#f8f9fa;border-radius:8px;padding:15px;">
<tr>
<td style="color:#666666;font-size:15px;padding:8px 0;">Subtotal:</td>
<td style="text-align:right;color:#1a1a1a;font-size:15px;font-weight:600;padding:8px 0;">¥${orderData.totalPrice.toLocaleString()}</td>
</tr>
${couponDiscount > 0 ? `
<tr>
<td style="color:#16a34a;font-size:15px;padding:8px 0;">🎫 Desconto:</td>
<td style="text-align:right;color:#16a34a;font-size:15px;font-weight:600;padding:8px 0;">-¥${couponDiscount.toLocaleString()}</td>
</tr>` : ''}
<tr>
<td style="color:#666666;font-size:15px;padding:8px 0;">🚚 Frete (${shipping.carrier}):</td>
<td style="text-align:right;color:#1a1a1a;font-size:15px;font-weight:600;padding:8px 0;">¥${shipping.cost.toLocaleString()}</td>
</tr>
<tr style="border-top:2px solid #FF69B4;">
<td style="color:#1a1a1a;font-size:18px;font-weight:700;padding:15px 0 8px 0;">💰 Total:</td>
<td style="text-align:right;color:#FF69B4;font-size:22px;font-weight:700;padding:15px 0 8px 0;">¥${(finalTotal + shipping.cost).toLocaleString()}</td>
</tr>
</table>
</td></tr>

<!-- Address -->
<tr><td style="padding:0 30px 30px 30px;">
<h3 style="margin:0 0 15px 0;color:#1a1a1a;font-size:18px;font-weight:600;border-bottom:2px solid #FF69B4;padding-bottom:10px;">📍 Endereço de Entrega</h3>
<div style="background-color:#f8f9fa;padding:20px;border-radius:8px;border-left:4px solid #FF69B4;">
<p style="margin:5px 0;font-size:14px;color:#1a1a1a;"><strong>${orderData.formData.name}</strong></p>
<p style="margin:5px 0;font-size:14px;color:#1a1a1a;">〒${orderData.formData.postalCode}</p>
<p style="margin:5px 0;font-size:14px;color:#1a1a1a;">${orderData.formData.prefecture} ${orderData.formData.city}</p>
<p style="margin:5px 0;font-size:14px;color:#1a1a1a;">${orderData.formData.address}</p>
${orderData.formData.building ? `<p style="margin:5px 0;font-size:14px;color:#1a1a1a;">${orderData.formData.building}</p>` : ''}
<p style="margin:5px 0;font-size:14px;color:#1a1a1a;">Tel: ${orderData.formData.phone}</p>
</div>
</td></tr>

<!-- Payment -->
<tr><td style="padding:0 30px 30px 30px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%" style="padding-right:10px;">
<div style="background-color:#f8f9fa;padding:15px;border-radius:8px;text-align:center;">
<div style="color:#666666;font-size:13px;margin-bottom:5px;">💳 Pagamento</div>
<div style="color:#1a1a1a;font-size:16px;font-weight:600;">${paymentMethod}</div>
</div>
</td>
<td width="50%" style="padding-left:10px;">
<div style="background-color:#f8f9fa;padding:15px;border-radius:8px;text-align:center;">
<div style="color:#666666;font-size:13px;margin-bottom:5px;">📞 Contato</div>
<div style="color:#1a1a1a;font-size:16px;font-weight:600;">${orderData.formData.phone}</div>
</div>
</td>
</tr>
</table>
</td></tr>

<!-- Next Steps -->
<tr><td style="padding:0 30px 30px 30px;">
<div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:20px;border-radius:8px;border-left:4px solid #f59e0b;">
<h4 style="margin:0 0 10px 0;color:#92400e;font-size:16px;font-weight:600;">🎯 Próximos Passos</h4>
<ul style="margin:0;padding-left:20px;color:#78350f;font-size:14px;line-height:1.8;">
<li>Seu pedido está sendo preparado com todo carinho</li>
<li>Em breve você receberá o código de rastreamento</li>
<li>Qualquer dúvida, entre em contato conosco</li>
</ul>
</div>
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#f8f9fa;padding:30px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 10px 0;color:#1a1a1a;font-size:16px;font-weight:600;">Japan Express - Importados do Japão</p>
<p style="margin:0 0 15px 0;color:#666666;font-size:14px;line-height:1.6;">
Sua conexão direta com os melhores cosméticos, papelaria, acessórios e doces exclusivos direto do Japão.<br>
Enviado com carinho e rapidez.
</p>
<div style="margin:20px 0;">
<a href="tel:070-1367-1679" style="display:inline-block;margin:0 10px;color:#FF69B4;text-decoration:none;font-size:14px;">📞 070-1367-1679</a>
<a href="mailto:contato@japanexpress-store.com" style="display:inline-block;margin:0 10px;color:#FF69B4;text-decoration:none;font-size:14px;">📧 contato@japanexpress-store.com</a>
</div>
<p style="margin:15px 0 0 0;color:#999999;font-size:12px;">© 2026 Japan Express. Todos os direitos reservados.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
      
      const emailParams = {
        to_email: orderData.formData.email,
        to_name: orderData.formData.name,
        subject: `✅ Pedido Confirmado - #${orderData.orderNumber}`,
        message: htmlContent,
      };
      
      devLog('📤 Sending order confirmation email via EmailJS...');
      
      const response = await getEmailJS().send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID_CUSTOMER,
        emailParams
      );
      
      devLog('✅ Email sent successfully!');
      devLog('📧 Response:', response);
      return true;
      
    } catch (error) {
      devError('❌ Error sending email:', error);
      return false;
    }
  },

  /**
   * Send new order notification to store owner
   */
  sendStoreNotification: async (orderData: any): Promise<boolean> => {
    devLog('🏪 EmailJS - Sending STORE notification');
    devLog('🏪 Service ID:', EMAILJS_SERVICE_ID);
    devLog('🏪 Template ID (STORE):', EMAILJS_TEMPLATE_ID_STORE, '(exists:', !!EMAILJS_TEMPLATE_ID_STORE, ')');
    devLog('🏪 Public Key:', EMAILJS_PUBLIC_KEY, '(exists:', !!EMAILJS_PUBLIC_KEY, ')');
    
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID_STORE || !EMAILJS_PUBLIC_KEY) {
      devError('❌ EmailJS store template not configured');
      return false;
    }
    
    try {
      await loadEmailJS();
      
      const itemsList = orderData.items.map((item: CartItem) => 
        `${productEnglishName(item.product as any)} (${item.size}) x${item.quantity} - ¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}`
      ).join('\n');
      
      const shippingAddress = `
${orderData.formData.name}
〒${orderData.formData.postalCode}
${orderData.formData.prefecture} ${orderData.formData.city}
${orderData.formData.address}
${orderData.formData.building || ''}
Tel: ${orderData.formData.phone}
      `.trim();
      
      const couponDiscount = orderData.couponDiscount || 0;
      const finalTotal = orderData.totalPrice - couponDiscount;
      const shipping = orderData.shipping || { carrier: 'N/A', cost: 0 };
      
      // Parameters for store notification (different from customer email)
      const storeParams = {
        to_email: 'dracko2007@gmail.com',
        to_name: 'Paula Shiokawa',
        customer_name: orderData.formData.name,
        customer_email: orderData.formData.email,
        customer_phone: orderData.formData.phone,
        order_number: orderData.orderNumber,
        order_date: new Date().toLocaleDateString('pt-BR'),
        items_list: itemsList,
        subtotal: `¥${orderData.totalPrice.toLocaleString()}`,
        discount: couponDiscount > 0 ? `-¥${couponDiscount.toLocaleString()}` : undefined,
        shipping_cost: `¥${shipping.cost.toLocaleString()}`,
        shipping_carrier: shipping.carrier,
        total_price: `¥${(finalTotal + shipping.cost).toLocaleString()}`,
        shipping_address: shippingAddress,
        payment_method: orderData.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'
      };
      
      devLog('📤 Sending store notification...');
      devLog('📤 Store Params:', storeParams);
      devLog('📤 Using Template ID:', EMAILJS_TEMPLATE_ID_STORE);
      
      const response = await getEmailJS().send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID_STORE,
        storeParams
      );
      
      devLog('✅ Store notification sent!');
      devLog('📧 Store Response:', response);
      return true;
      
    } catch (error) {
      devError('❌ Error sending store notification:', error);
      return false;
    }
  },

  /**
   * Send tracking number notification email with custom HTML
   */
  sendTrackingNotification: async (params: {
    to_email: string;
    to_name: string;
    order_number: string;
    tracking_number: string;
    carrier_name: string;
    tracking_url?: string;
    items_list: string;
    total_price: string;
    shipping_address: string;
    html_content: string;
  }): Promise<boolean> => {
    devLog('📧 EmailJS - Sending tracking notification to customer');
    devLog('📧 To:', params.to_email);
    devLog('📧 Tracking:', params.tracking_number);
    
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID_CUSTOMER || !EMAILJS_PUBLIC_KEY) {
      devError('❌ EmailJS not configured');
      return false;
    }
    
    try {
      await loadEmailJS();
      
      // Send the full HTML content as 'message' - the EmailJS template just renders {{message}}
      const emailParams = {
        to_email: params.to_email,
        to_name: params.to_name,
        subject: `📦 Pedido Enviado - #${params.order_number} - Rastreamento: ${params.tracking_number}`,
        message: params.html_content,
      };
      
      devLog('📤 Sending tracking email via EmailJS...');
      devLog('📤 Carrier:', params.carrier_name);
      devLog('📤 Tracking URL:', params.tracking_url);
      
      const response = await getEmailJS().send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID_CUSTOMER,
        emailParams
      );
      
      devLog('✅ Tracking email sent successfully!');
      return true;
      
    } catch (error) {
      devError('❌ Error sending tracking email:', error);
      return false;
    }
  }
};
