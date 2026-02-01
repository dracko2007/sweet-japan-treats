/**
 * Email Service
 * 
 * Sends order confirmation emails using Resend API
 */

import type { EmailOrderData, CartItem, ShippingLabelData } from '@/types/order';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  orderNumber: string;
  customerName: string;
  trackingNumber?: string;
  shippingLabelData?: ShippingLabelData;
}

// Resend API configuration
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev'; // Use Resend's test domain if not configured

export const emailService = {
  /**
   * Send order confirmation email using Resend
   */
  sendOrderConfirmation: async (data: EmailData): Promise<boolean> => {
    console.log('📧 Email Service - Sending order confirmation email');
    console.log('📧 API Key configured:', !!RESEND_API_KEY);
    console.log('📧 From:', FROM_EMAIL);
    console.log('📧 To:', data.to);
    console.log('📧 Subject:', data.subject);
    console.log('📧 Order Number:', data.orderNumber);
    if (data.trackingNumber) {
      console.log('🔢 Tracking Number:', data.trackingNumber);
    }
    
    // If no API key, fallback to console logging
    if (!RESEND_API_KEY) {
      console.warn('⚠️ VITE_RESEND_API_KEY not configured - opening email preview');
      console.log('💡 Configure VITE_RESEND_API_KEY in .env and Vercel to enable automatic emails');
      
      // Open email in new window for testing
      const emailWindow = window.open('', '_blank');
      if (emailWindow) {
        emailWindow.document.write(data.html);
        emailWindow.document.close();
      }
      
      return false;
    }
    
    try {
      console.log('📤 Sending request to Resend API...');
      console.log('📤 API Key configured:', !!RESEND_API_KEY, RESEND_API_KEY?.substring(0, 10) + '...');
      console.log('📤 Request body:', {
        from: FROM_EMAIL,
        to: data.to,
        subject: data.subject,
        htmlLength: data.html.length
      });
      
      const requestBody = {
        from: FROM_EMAIL,
        to: data.to,
        subject: data.subject,
        html: data.html
      };
      
      console.log('📤 Making fetch request...');
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response received!');
      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('📥 Response body (raw):', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse response as JSON:', e);
        result = { error: responseText };
      }
      
      console.log('📥 Response data (parsed):', result);

      if (!response.ok) {
        console.error('❌ Resend API error:', {
          status: response.status,
          statusText: response.statusText,
          error: result
        });
        
        // Show detailed error to user
        const errorMessage = result.message || result.error || 'Erro desconhecido';
        alert(`❌ Erro ao enviar email:\n\n${errorMessage}\n\nStatus: ${response.status}\n\nVerifique o console (F12) para mais detalhes.`);
        
        return false;
      }

      console.log('✅ Email sent successfully via Resend!');
      console.log('📧 Email ID:', result.id);
      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      console.error('❌ Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      alert(`❌ Erro ao enviar email:\n\n${(error as Error).message}\n\nVerifique sua conexão e o console (F12).`);
      return false;
    }
  },

  /**
   * Generate HTML email template for order confirmation
   * Includes shipping label with QR code for store owner
   */
  generateOrderEmailHTML: (orderData: EmailOrderData, trackingNumber?: string): string => {
    const { orderNumber, formData, items, totalPrice, shipping, paymentMethod, deliveryTime } = orderData;
    
    // Generate QR code data
    const qrData = JSON.stringify({
      orderNumber,
      trackingNumber: trackingNumber || '',
      recipientName: formData.name,
      recipientPostal: formData.postalCode,
      recipientAddress: `${formData.prefecture} ${formData.city} ${formData.address} ${formData.building || ''}`.trim(),
      recipientPhone: formData.phone,
      senderName: 'Paula Shiokawa',
      senderPostal: '518-0225',
      senderAddress: 'Mie-ken Iga-shi Kirigaoka 5-292',
      senderPhone: '070-1367-1679',
      carrier: shipping?.carrier || '',
      deliveryTime: deliveryTime || 'Qualquer horário'
    });

    // Note: In backend, generate actual QR code image and embed as base64
    // For now, this is a placeholder that backend will replace with:
    // <img src="data:image/png;base64,{qrCodeBase64}" alt="QR Code" />
    const qrCodePlaceholder = `[QR CODE WILL BE GENERATED IN BACKEND - Data: ${qrData.substring(0, 50)}...]`;
    
    const deliveryTimeText = 
      deliveryTime === 'morning' ? '9:00-12:00 (Manhã)' :
      deliveryTime === 'afternoon' ? '12:00-17:00 (Tarde)' :
      deliveryTime === 'evening' ? '17:00-20:00 (Noite)' :
      'Qualquer horário';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmação de Pedido</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .header {
            background: linear-gradient(135deg, #d4a574 0%, #c08552 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: white;
            padding: 30px;
            border: 1px solid #ddd;
          }
          .section {
            background: #f9f9f9;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #c08552;
          }
          .section h2 {
            color: #c08552;
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 18px;
          }
          .order-number {
            font-size: 24px;
            font-weight: bold;
            color: #c08552;
            margin: 10px 0;
            text-align: center;
            padding: 15px;
            background: #fff3cd;
            border-radius: 8px;
          }
          .product-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
          }
          .product-item:last-child {
            border-bottom: none;
          }
          .total {
            font-size: 20px;
            font-weight: bold;
            color: #c08552;
            text-align: right;
            margin-top: 20px;
            padding: 15px;
            background: #fff;
            border: 2px solid #c08552;
            border-radius: 8px;
          }
          .shipping-label {
            border: 3px solid #000;
            padding: 20px;
            margin: 20px 0;
            background: white;
            page-break-inside: avoid;
          }
          .label-header {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            background: #000;
            color: white;
            padding: 10px;
            margin: -20px -20px 20px -20px;
          }
          .label-section {
            border: 2px solid #000;
            padding: 15px;
            margin: 15px 0;
          }
          .label-section-title {
            background: #f0f0f0;
            padding: 8px;
            font-weight: bold;
            margin: -15px -15px 10px -15px;
          }
          .postal-code {
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 2px;
            margin: 5px 0;
          }
          .address-line {
            margin: 5px 0;
            font-size: 15px;
          }
          .qr-section {
            text-align: center;
            padding: 20px;
            background: #f9f9f9;
            border: 2px dashed #666;
            margin: 15px 0;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
            background: #f9f9f9;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 15px 0;
          }
          @media print {
            body { background: white; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍯 Doce de Leite</h1>
          <p>Confirmação de Pedido</p>
        </div>
        
        <div class="content">
          <div class="order-number">Pedido: ${orderNumber}</div>
          
          <div class="section">
            <h2>✅ Pedido Confirmado!</h2>
            <p>Olá ${formData.name},</p>
            <p>Obrigado pela sua compra! Seu pedido foi confirmado e está sendo preparado.</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            ${trackingNumber ? `<p><strong>Rastreamento:</strong> <span style="font-family: monospace; font-size: 16px; background: #fff3cd; padding: 5px 10px; border-radius: 4px;">${trackingNumber}</span></p>` : ''}
          </div>

          <div class="section">
            <h2>📦 Produtos</h2>
            ${items.map((item: CartItem) => `
              <div class="product-item">
                <div>
                  <strong>${item.product.name}</strong><br>
                  <small>Tamanho: ${item.size} | Quantidade: ${item.quantity}</small>
                </div>
                <div style="text-align: right;">
                  <strong>¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}</strong>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="section">
            <h2>📍 Endereço de Entrega</h2>
            <div style="padding: 10px; background: white; border: 1px solid #ddd; border-radius: 4px;">
              <strong>${formData.name}</strong><br>
              〒${formData.postalCode}<br>
              ${formData.prefecture} ${formData.city}<br>
              ${formData.address}<br>
              ${formData.building ? formData.building + '<br>' : ''}
              📞 ${formData.phone}<br>
              📧 ${formData.email}
            </div>
          </div>

          <div class="section">
            <h2>💰 Resumo do Pedido</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px;">Subtotal:</td>
                <td style="text-align: right; padding: 8px;">¥${totalPrice.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">Frete (${shipping?.carrier || 'N/A'}):</td>
                <td style="text-align: right; padding: 8px;">¥${shipping?.cost?.toLocaleString() || '0'}</td>
              </tr>
              <tr style="border-top: 2px solid #c08552;">
                <td style="padding: 8px;"><strong>Total:</strong></td>
                <td style="text-align: right; padding: 8px;"><strong style="font-size: 20px; color: #c08552;">¥${((totalPrice || 0) + (shipping?.cost || 0)).toLocaleString()}</strong></td>
              </tr>
            </table>
            <p style="margin-top: 10px;"><strong>Entrega:</strong> ${shipping?.estimatedDays || 'N/A'} dias úteis</p>
            ${deliveryTime ? `<p><strong>Horário Preferido:</strong> ${deliveryTimeText}</p>` : ''}
          </div>

          <div class="section">
            <h2>💳 Pagamento</h2>
            <p><strong>Método:</strong> ${paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}</p>
            ${paymentMethod === 'bank' ? `
              <div class="info-box">
                <p><strong>Por favor, realize o depósito para:</strong></p>
                <p style="margin: 10px 0;">
                  <!-- TODO: Replace with actual bank account details before production -->
                  <strong>Banco:</strong> [Nome do Banco - Configure no .env]<br>
                  <strong>Agência:</strong> [Número da Agência - Configure no .env]<br>
                  <strong>Conta:</strong> [Número da Conta - Configure no .env]<br>
                  <strong>Nome:</strong> Paula Shiokawa
                </p>
                <p style="color: #856404; margin-top: 10px;">
                  ⚠️ <strong>Importante:</strong> Envie o comprovante via WhatsApp: 070-1367-1679
                </p>
              </div>
            ` : `
              <div class="info-box">
                <p><strong>Envie o pagamento via PayPay para:</strong></p>
                <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">070-1367-1679</p>
                <p style="color: #856404;">
                  ⚠️ <strong>Importante:</strong> Após o pagamento, envie a confirmação via WhatsApp
                </p>
              </div>
            `}
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">

          <!-- SHIPPING LABEL FOR STORE OWNER -->
          <div class="info-box no-print" style="background: #fff3cd; border-color: #ffc107;">
            <h2 style="margin-top: 0; color: #856404;">📋 Para a Loja (Paula Shiokawa)</h2>
            <p><strong>Esta seção contém a etiqueta de envio para imprimir e colar no pacote.</strong></p>
          </div>

          <div class="shipping-label">
            <div class="label-header">
              ETIQUETA DE ENVIO - Pedido ${orderNumber}
            </div>

            ${trackingNumber ? `
              <div style="text-align: center; background: #4caf50; color: white; padding: 10px; margin: 0 -20px 20px -20px;">
                <strong>Rastreamento:</strong> ${trackingNumber}
              </div>
            ` : ''}

            <div style="text-align: center; background: #f0f0f0; padding: 10px; margin-bottom: 20px; font-size: 18px; font-weight: bold;">
              ${shipping?.carrier || 'Transportadora'}
            </div>

            <!-- Recipient Section -->
            <div class="label-section">
              <div class="label-section-title">📍 DESTINATÁRIO (お届け先)</div>
              <div class="postal-code">〒 ${formData.postalCode}</div>
              <div class="address-line"><strong>${formData.name} 様</strong></div>
              <div class="address-line">${formData.prefecture} ${formData.city}</div>
              <div class="address-line">${formData.address}</div>
              ${formData.building ? `<div class="address-line">${formData.building}</div>` : ''}
              <div class="address-line">📞 ${formData.phone}</div>
              ${deliveryTime ? `
                <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
                  <strong>⏰ Horário Preferido:</strong> ${deliveryTimeText}
                </div>
              ` : ''}
            </div>

            <!-- Sender Section -->
            <div class="label-section">
              <div class="label-section-title">📤 REMETENTE (ご依頼主)</div>
              <div class="postal-code">〒 518-0225</div>
              <div class="address-line"><strong>Paula Shiokawa</strong></div>
              <div class="address-line">Mie-ken Iga-shi Kirigaoka 5-292</div>
              <div class="address-line">三重県 伊賀市 桐ヶ丘 5-292</div>
              <div class="address-line">📞 070-1367-1679</div>
            </div>

            <!-- QR Code Section -->
            <div class="qr-section">
              <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
                📱 QRコード (Código de Rastreamento)
              </div>
              <div style="display: inline-block; padding: 15px; background: white; border: 3px solid #000;">
                <div style="width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; background: #f0f0f0;">
                  ${qrCodePlaceholder}
                </div>
              </div>
              <div style="margin-top: 10px; font-size: 13px; color: #666;">
                Escaneie este código na transportadora para registro automático
              </div>
            </div>

            <!-- Instructions -->
            <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; font-size: 12px;">
              <strong style="color: #1976d2;">📋 Instruções de Envio:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Imprima esta etiqueta</li>
                <li>Cole na caixa de forma visível</li>
                <li>Apresente o QR code ao atendente da transportadora</li>
                <li>Guarde o número de rastreamento: <strong>${trackingNumber || 'será gerado'}</strong></li>
              </ul>
            </div>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">

          <div class="section">
            <h2>📝 Próximos Passos</h2>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Realize o pagamento conforme as instruções acima</li>
              <li>Envie o comprovante via WhatsApp (070-1367-1679)</li>
              <li>Aguarde a confirmação do pagamento</li>
              <li>Seu pedido será enviado em até 2 dias úteis</li>
              <li>Você receberá o código de rastreamento por email</li>
            </ol>
          </div>
        </div>

        <div class="footer">
          <p><strong>Doce de Leite</strong> - Sabor Brasileiro no Japão 🇧🇷</p>
          <p>📍 Mie-ken Iga-shi Kirigaoka 5-292, 〒518-0225</p>
          <p>📞 070-1367-1679 | 📧 contato@docedeleite.jp</p>
          <p style="margin-top: 15px; font-size: 12px; color: #999;">
            Se tiver dúvidas, entre em contato conosco via WhatsApp!
          </p>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generate customer email (WITHOUT shipping label)
   */
  generateCustomerEmailHTML: (orderData: EmailOrderData, trackingNumber?: string): string => {
    const { orderNumber, formData, items, totalPrice, shipping, paymentMethod, deliveryTime } = orderData;
    
    const deliveryTimeText = 
      deliveryTime === 'morning' ? '9:00-12:00 (Manhã)' :
      deliveryTime === 'afternoon' ? '12:00-17:00 (Tarde)' :
      deliveryTime === 'evening' ? '17:00-20:00 (Noite)' :
      'Qualquer horário';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Confirmação de Pedido</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .header { background: linear-gradient(135deg, #d4a574 0%, #c08552 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; }
          .section { background: #f9f9f9; padding: 20px; margin-bottom: 20px; border-radius: 8px; border-left: 4px solid #c08552; }
          .section h2 { color: #c08552; margin-top: 0; margin-bottom: 15px; font-size: 18px; }
          .order-number { font-size: 24px; font-weight: bold; color: #c08552; margin: 10px 0; text-align: center; padding: 15px; background: #fff3cd; border-radius: 8px; }
          .product-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
          .product-item:last-child { border-bottom: none; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; background: #f9f9f9; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍯 Sabor do Campo</h1>
          <p>Confirmação de Pedido</p>
        </div>
        
        <div class="content">
          <div class="order-number">Pedido: ${orderNumber}</div>
          
          <div class="section">
            <h2>✅ Pedido Confirmado!</h2>
            <p>Olá ${formData.name},</p>
            <p>Obrigado pela sua compra! Seu pedido foi confirmado e está sendo preparado.</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            ${trackingNumber ? `<p><strong>Rastreamento:</strong> <span style="font-family: monospace; font-size: 16px; background: #fff3cd; padding: 5px 10px; border-radius: 4px;">${trackingNumber}</span></p>` : ''}
          </div>

          <div class="section">
            <h2>📦 Produtos</h2>
            ${items.map((item: CartItem) => `
              <div class="product-item">
                <div>
                  <strong>${item.product.name}</strong><br>
                  <small>Tamanho: ${item.size} | Quantidade: ${item.quantity}</small>
                </div>
                <div style="text-align: right;">
                  <strong>¥${(item.product.prices[item.size] * item.quantity).toLocaleString()}</strong>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="section">
            <h2>📍 Endereço de Entrega</h2>
            <div style="padding: 10px; background: white; border: 1px solid #ddd; border-radius: 4px;">
              <strong>${formData.name}</strong><br>
              〒${formData.postalCode}<br>
              ${formData.prefecture} ${formData.city}<br>
              ${formData.address}<br>
              ${formData.building ? formData.building + '<br>' : ''}
              📞 ${formData.phone}
            </div>
          </div>

          <div class="section">
            <h2>💰 Resumo do Pedido</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px;">Subtotal:</td>
                <td style="text-align: right; padding: 8px;">¥${totalPrice.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px;">Frete (${shipping?.carrier || 'N/A'}):</td>
                <td style="text-align: right; padding: 8px;">¥${shipping?.cost?.toLocaleString() || '0'}</td>
              </tr>
              <tr style="border-top: 2px solid #c08552;">
                <td style="padding: 8px;"><strong>Total:</strong></td>
                <td style="text-align: right; padding: 8px;"><strong style="font-size: 20px; color: #c08552;">¥${((totalPrice || 0) + (shipping?.cost || 0)).toLocaleString()}</strong></td>
              </tr>
            </table>
            <p style="margin-top: 10px;"><strong>Entrega:</strong> ${shipping?.estimatedDays || 'N/A'} dias úteis</p>
            ${deliveryTime ? `<p><strong>Horário Preferido:</strong> ${deliveryTimeText}</p>` : ''}
          </div>

          <div class="section">
            <h2>💳 Pagamento</h2>
            <p><strong>Método:</strong> ${paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}</p>
            ${paymentMethod === 'bank' ? `
              <div class="info-box">
                <p><strong>Por favor, realize o depósito para:</strong></p>
                <p style="margin: 10px 0;">
                  <strong>Banco:</strong> [Nome do Banco]<br>
                  <strong>Agência:</strong> [Número da Agência]<br>
                  <strong>Conta:</strong> [Número da Conta]<br>
                  <strong>Nome:</strong> Paula Shiokawa
                </p>
                <p style="color: #856404; margin-top: 10px;">
                  ⚠️ <strong>Importante:</strong> Envie o comprovante via WhatsApp: 070-1367-1679
                </p>
              </div>
            ` : `
              <div class="info-box">
                <p><strong>Envie o pagamento via PayPay para:</strong></p>
                <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">070-1367-1679</p>
                <p style="color: #856404;">
                  ⚠️ <strong>Importante:</strong> Após o pagamento, envie a confirmação via WhatsApp
                </p>
              </div>
            `}
          </div>

          <div class="section">
            <h2>📝 Próximos Passos</h2>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Realize o pagamento conforme as instruções acima</li>
              <li>Envie o comprovante via WhatsApp (070-1367-1679)</li>
              <li>Aguarde a confirmação do pagamento</li>
              <li>Seu pedido será enviado em até 2 dias úteis</li>
              <li>Você receberá o código de rastreamento por email</li>
            </ol>
          </div>
        </div>

        <div class="footer">
          <p><strong>Sabor do Campo</strong> - Doce de Leite Artesanal 🇧🇷</p>
          <p>📍 Mie-ken Iga-shi Kirigaoka 5-292, 〒518-0225</p>
          <p>📞 070-1367-1679 | 📧 dracko2007@gmail.com</p>
          <p style="margin-top: 15px; font-size: 12px; color: #999;">
            Se tiver dúvidas, entre em contato conosco via WhatsApp!
          </p>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generate store owner email (WITH shipping label)
   */
  generateStoreEmailHTML: (orderData: EmailOrderData, trackingNumber?: string): string => {
    // Reuse the original method that includes shipping label
    return emailService.generateOrderEmailHTML(orderData, trackingNumber);
  }
};


