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

declare const emailjs: any;

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// Load EmailJS library dynamically
let emailjsLoaded = false;
const loadEmailJS = (): Promise<void> => {
  if (emailjsLoaded || typeof emailjs !== 'undefined') {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = () => {
      emailjsLoaded = true;
      if (EMAILJS_PUBLIC_KEY) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
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
  total_price: string;
  shipping_address: string;
  payment_method: string;
  phone: string;
}

export const emailServiceSimple = {
  /**
   * Send email using EmailJS
   */
  sendOrderConfirmation: async (orderData: any): Promise<boolean> => {
    console.log('📧 EmailJS - Sending order confirmation');
    console.log('📧 Service ID:', !!EMAILJS_SERVICE_ID);
    console.log('📧 Template ID:', !!EMAILJS_TEMPLATE_ID);
    console.log('📧 Public Key:', !!EMAILJS_PUBLIC_KEY);
    
    // Check if EmailJS is configured
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      console.warn('⚠️ EmailJS não configurado - abrindo email no cliente padrão');
      
      // Fallback: open default email client with pre-filled content
      const subject = `Pedido ${orderData.orderNumber} - Sabor do Campo`;
      const body = `
Olá ${orderData.formData.name},

Seu pedido foi confirmado!

Pedido: ${orderData.orderNumber}
Data: ${new Date().toLocaleDateString('pt-BR')}

Produtos:
${orderData.items.map((item: CartItem) => 
  `• ${item.product.name} (${item.size}) x${item.quantity} - ¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}`
).join('\n')}

Total: ¥${orderData.totalPrice.toLocaleString()}

Endereço de Entrega:
${orderData.formData.name}
〒${orderData.formData.postalCode}
${orderData.formData.prefecture} ${orderData.formData.city}
${orderData.formData.address}
${orderData.formData.building || ''}

Obrigado pela preferência!
Sabor do Campo
      `.trim();
      
      const mailtoLink = `mailto:${orderData.formData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');
      return false;
    }
    
    try {
      // Load EmailJS library
      await loadEmailJS();
      
      // Prepare email parameters
      const itemsList = orderData.items.map((item: CartItem) => 
        `${item.product.name} (${item.size}) x${item.quantity} - ¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}`
      ).join('\n');
      
      const shippingAddress = `
${orderData.formData.name}
〒${orderData.formData.postalCode}
${orderData.formData.prefecture} ${orderData.formData.city}
${orderData.formData.address}
${orderData.formData.building || ''}
Tel: ${orderData.formData.phone}
      `.trim();
      
      const emailParams: EmailParams = {
        to_email: orderData.formData.email,
        to_name: orderData.formData.name,
        order_number: orderData.orderNumber,
        order_date: new Date().toLocaleDateString('pt-BR'),
        items_list: itemsList,
        total_price: `¥${orderData.totalPrice.toLocaleString()}`,
        shipping_address: shippingAddress,
        payment_method: orderData.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay',
        phone: orderData.formData.phone
      };
      
      console.log('📤 Sending email via EmailJS...');
      console.log('📤 Params:', emailParams);
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams
      );
      
      console.log('✅ Email sent successfully!');
      console.log('📧 Response:', response);
      return true;
      
    } catch (error) {
      console.error('❌ Error sending email:', error);
      
      // Fallback: open default email client
      const subject = `Pedido ${orderData.orderNumber} - Sabor do Campo`;
      const body = `
Olá ${orderData.formData.name},

Seu pedido foi confirmado!

Pedido: ${orderData.orderNumber}
Data: ${new Date().toLocaleDateString('pt-BR')}

Produtos:
${orderData.items.map((item: CartItem) => 
  `• ${item.product.name} (${item.size}) x${item.quantity}`
).join('\n')}

Total: ¥${orderData.totalPrice.toLocaleString()}

Obrigado pela preferência!
Sabor do Campo
      `.trim();
      
      const mailtoLink = `mailto:${orderData.formData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');
      
      return false;
    }
  }
};
