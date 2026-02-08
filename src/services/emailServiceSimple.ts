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

declare const emailjs: any;

const EMAILJS_SERVICE_ID = emailJsConfig.serviceId;
const EMAILJS_TEMPLATE_ID_CUSTOMER = emailJsConfig.templateIdCustomer;
const EMAILJS_TEMPLATE_ID_STORE = emailJsConfig.templateIdStore;
const EMAILJS_PUBLIC_KEY = emailJsConfig.publicKey;

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
    console.log('📧 EmailJS - Sending order confirmation to customer');
    console.log('📧 Service ID:', EMAILJS_SERVICE_ID, '(exists:', !!EMAILJS_SERVICE_ID, ')');
    console.log('📧 Template ID:', EMAILJS_TEMPLATE_ID_CUSTOMER, '(exists:', !!EMAILJS_TEMPLATE_ID_CUSTOMER, ')');
    console.log('📧 Public Key:', EMAILJS_PUBLIC_KEY, '(exists:', !!EMAILJS_PUBLIC_KEY, ')');
    
    // Check if EmailJS is configured
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID_CUSTOMER || !EMAILJS_PUBLIC_KEY) {
      console.error('❌ EmailJS NÃO configurado - emails não serão enviados automaticamente');
      console.log('💡 Configure EmailJS no .env para enviar emails automaticamente');
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
      
      const couponDiscount = orderData.couponDiscount || 0;
      const finalTotal = orderData.totalPrice - couponDiscount;
      const shipping = orderData.shipping || { carrier: 'N/A', cost: 0 };
      
      const emailParams: EmailParams = {
        to_email: orderData.formData.email,
        to_name: orderData.formData.name,
        order_number: orderData.orderNumber,
        order_date: new Date().toLocaleDateString('pt-BR'),
        items_list: itemsList,
        subtotal: `¥${orderData.totalPrice.toLocaleString()}`,
        discount: couponDiscount > 0 ? `-¥${couponDiscount.toLocaleString()}` : undefined,
        shipping_cost: `¥${shipping.cost.toLocaleString()}`,
        shipping_carrier: shipping.carrier,
        total_price: `¥${(finalTotal + shipping.cost).toLocaleString()}`,
        shipping_address: shippingAddress,
        payment_method: orderData.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay',
        phone: orderData.formData.phone
      };
      
      console.log('📤 Sending email via EmailJS...');
      console.log('📤 Params:', emailParams);
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID_CUSTOMER,
        emailParams
      );
      
      console.log('✅ Email sent successfully!');
      console.log('📧 Response:', response);
      return true;
      
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  },

  /**
   * Send new order notification to store owner
   */
  sendStoreNotification: async (orderData: any): Promise<boolean> => {
    console.log('🏪 EmailJS - Sending STORE notification');
    console.log('🏪 Service ID:', EMAILJS_SERVICE_ID);
    console.log('🏪 Template ID (STORE):', EMAILJS_TEMPLATE_ID_STORE, '(exists:', !!EMAILJS_TEMPLATE_ID_STORE, ')');
    console.log('🏪 Public Key:', EMAILJS_PUBLIC_KEY, '(exists:', !!EMAILJS_PUBLIC_KEY, ')');
    
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID_STORE || !EMAILJS_PUBLIC_KEY) {
      console.error('❌ EmailJS store template not configured');
      return false;
    }
    
    try {
      await loadEmailJS();
      
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
      
      console.log('📤 Sending store notification...');
      console.log('📤 Store Params:', storeParams);
      console.log('📤 Using Template ID:', EMAILJS_TEMPLATE_ID_STORE);
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID_STORE,
        storeParams
      );
      
      console.log('✅ Store notification sent!');
      console.log('📧 Store Response:', response);
      return true;
      
    } catch (error) {
      console.error('❌ Error sending store notification:', error);
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
    console.log('📧 EmailJS - Sending tracking notification to customer');
    console.log('📧 To:', params.to_email);
    console.log('📧 Tracking:', params.tracking_number);
    
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID_CUSTOMER || !EMAILJS_PUBLIC_KEY) {
      console.error('❌ EmailJS not configured');
      return false;
    }
    
    try {
      await loadEmailJS();
      
      const emailParams = {
        to_email: params.to_email,
        to_name: params.to_name,
        subject: `📦 Pedido Enviado - #${params.order_number}`,
        order_number: params.order_number,
        order_date: new Date().toLocaleDateString('pt-BR'),
        tracking_number: params.tracking_number,
        carrier_name: params.carrier_name,
        tracking_url: params.tracking_url || '',
        items_list: params.items_list,
        subtotal: params.total_price,
        total_price: params.total_price,
        shipping_address: params.shipping_address,
        shipping_carrier: params.carrier_name,
        shipping_cost: '¥0',
        payment_method: 'Já pago',
        phone: '-',
        message: params.html_content,
      };
      
      console.log('📤 Sending tracking email via EmailJS...');
      console.log('📤 Tracking URL:', params.tracking_url);
      console.log('📤 Params:', emailParams);
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID_CUSTOMER,
        emailParams
      );
      
      console.log('✅ Tracking email sent successfully!');
      console.log('📧 Response:', response);
      return true;
      
    } catch (error) {
      console.error('❌ Error sending tracking email:', error);
      console.error('Error details:', error);
      return false;
    }
  }
};
