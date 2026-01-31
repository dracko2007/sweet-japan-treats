/**
 * Email Service
 * 
 * This module handles sending emails through a backend API.
 * 
 * IMPLEMENTATION NOTES:
 * - This is a frontend mock that logs to console
 * - Real implementation requires a backend server
 * - Backend should use services like SendGrid, AWS SES, or Resend
 */

interface EmailData {
  to: string;
  subject: string;
  html: string;
  orderNumber: string;
  customerName: string;
}

export const emailService = {
  /**
   * Send order confirmation email
   */
  sendOrderConfirmation: async (data: EmailData): Promise<boolean> => {
    console.log('📧 Email Service - Sending order confirmation email');
    console.log('To:', data.to);
    console.log('Subject:', data.subject);
    console.log('Order Number:', data.orderNumber);
    
    // Mock API call - replace with real backend endpoint
    try {
      console.log('✅ Email would be sent successfully (backend integration required)');
      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  },

  /**
   * Generate HTML email template for order confirmation
   */
  generateOrderEmailHTML: (orderData: any): string => {
    const { orderNumber, formData, items, totalPrice, shipping, paymentMethod } = orderData;
    
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #d4a574 0%, #c08552 100%); color: white; padding: 30px; text-align: center; }
          .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="header"><h1>🍯 Doce de Leite</h1><p>Pedido ${orderNumber}</p></div>
        <div class="section"><h2>✅ Pedido Confirmado!</h2><p>Total: ¥${((totalPrice || 0) + (shipping?.cost || 0)).toLocaleString()}</p></div>
      </body>
      </html>
    `;
  }
};
