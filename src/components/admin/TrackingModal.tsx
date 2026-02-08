import React, { useState } from 'react';
import { Package, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { emailService } from '@/services/emailService';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { whatsappService } from '@/services/whatsappService';
import { useToast } from '@/hooks/use-toast';

interface TrackingModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (trackingNumber: string, carrier: string) => void;
}

const TrackingModal: React.FC<TrackingModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState(order?.shipping?.carrier || '');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Get tracking URL based on carrier
  const getTrackingUrl = (carrier: string, trackingNumber: string): string => {
    const lowerCarrier = carrier.toLowerCase();
    
    if (lowerCarrier.includes('yamato') || lowerCarrier.includes('クロネコ')) {
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${trackingNumber}`;
    } else if (lowerCarrier.includes('sagawa') || lowerCarrier.includes('佐川')) {
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}`;
    } else if (lowerCarrier.includes('japan post') || lowerCarrier.includes('ゆうパック') || lowerCarrier.includes('post')) {
      return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${trackingNumber}&locale=ja`;
    } else if (lowerCarrier.includes('fukutsu') || lowerCarrier.includes('福通')) {
      return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${trackingNumber}`;
    }
    
    // Default: return generic tracking message
    return '';
  };

  // Get carrier name for display
  const getCarrierName = (carrier: string): string => {
    const lowerCarrier = carrier.toLowerCase();
    
    if (lowerCarrier.includes('yamato') || lowerCarrier.includes('クロネコ')) {
      return 'Yamato Transport (クロネコヤマト)';
    } else if (lowerCarrier.includes('sagawa') || lowerCarrier.includes('佐川')) {
      return 'Sagawa Express (佐川急便)';
    } else if (lowerCarrier.includes('japan post') || lowerCarrier.includes('ゆうパック') || lowerCarrier.includes('post')) {
      return 'Japan Post (日本郵便)';
    } else if (lowerCarrier.includes('fukutsu') || lowerCarrier.includes('福通')) {
      return 'Fukutsu Express (福山通運)';
    }
    
    return carrier;
  };

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) {
      toast({
        title: "Erro",
        description: "Digite o número de rastreamento",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const carrierName = getCarrierName(selectedCarrier || order.shipping?.carrier || '');
      const trackingUrl = getTrackingUrl(selectedCarrier || order.shipping?.carrier || '', trackingNumber);
      
      // Send shipping confirmation email
      const emailHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #D2691E 0%, #8B4513 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .tracking-box { background: #fff; border: 2px solid #D2691E; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .tracking-number { font-size: 24px; font-weight: bold; color: #D2691E; letter-spacing: 2px; margin: 10px 0; }
            .tracking-button { display: inline-block; background: #D2691E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
            .tracking-button:hover { background: #8B4513; }
            .product-list { margin: 20px 0; }
            .product-item { background: #fff; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #D2691E; }
            .info-row { display: flex; justify-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Seu Pedido Foi Enviado!</h1>
              <p>Pedido #${order.orderNumber}</p>
            </div>
            
            <div class="content">
              <p><strong>Olá ${order.shippingAddress.name}!</strong></p>
              
              <p>Seu pedido foi enviado e está a caminho! 🎉</p>
              
              <div class="tracking-box">
                <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Transportadora:</p>
                <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 16px;">${carrierName}</p>
                
                <p style="margin: 0 0 10px 0; color: #666;">Número de Rastreamento:</p>
                <div class="tracking-number">${trackingNumber}</div>
                
                ${trackingUrl ? `
                  <a href="${trackingUrl}" class="tracking-button" target="_blank">
                    🔍 Rastrear Pedido
                  </a>
                  <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
                    Ou copie o código acima e cole no site da transportadora
                  </p>
                ` : `
                  <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
                    Use este código para rastrear seu pedido no site da transportadora.
                  </p>
                `}
              </div>

              <h3 style="color: #D2691E; margin-top: 30px;">📋 Resumo do Pedido</h3>
              
              <div class="product-list">
                ${order.items.map((item: any) => `
                  <div class="product-item">
                    <strong>${item.productName}</strong> (${item.size})<br>
                    Quantidade: ${item.quantity} × ¥${item.price.toLocaleString()}<br>
                    <strong>Subtotal: ¥${(item.price * item.quantity).toLocaleString()}</strong>
                  </div>
                `).join('')}
              </div>

              <div style="background: #fff; padding: 20px; border-radius: 8px; margin-top: 20px;">
                <div class="info-row">
                  <span>Subtotal:</span>
                  <strong>¥${order.totalPrice.toLocaleString()}</strong>
                </div>
                <div class="info-row" style="font-size: 18px; color: #D2691E; border-bottom: none;">
                  <span><strong>Total:</strong></span>
                  <strong>¥${order.totalPrice.toLocaleString()}</strong>
                </div>
              </div>

              <h3 style="color: #D2691E; margin-top: 30px;">📍 Endereço de Entrega</h3>
              <div style="background: #fff; padding: 20px; border-radius: 8px;">
                <p style="margin: 5px 0;"><strong>${order.shippingAddress.name}</strong></p>
                <p style="margin: 5px 0;">〒${order.shippingAddress.postalCode}</p>
                <p style="margin: 5px 0;">${order.shippingAddress.prefecture}</p>
                <p style="margin: 5px 0;">${order.shippingAddress.city}</p>
                <p style="margin: 5px 0;">${order.shippingAddress.address}</p>
                ${order.shippingAddress.building ? `<p style="margin: 5px 0;">${order.shippingAddress.building}</p>` : ''}
              </div>

              <p style="margin-top: 30px;">
                Obrigado por comprar na <strong>Sabor do Campo</strong>! 🍯
              </p>
            </div>

            <div class="footer">
              <p>Sabor do Campo - Doce de Leite Artesanal</p>
              <p>Mie Prefecture, Japan</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Try Resend first, fallback to EmailJS
      let emailSent = false;
      
      if (import.meta.env.VITE_RESEND_API_KEY) {
        emailSent = await emailService.sendOrderConfirmation({
          to: order.customerEmail || order.shippingAddress.email,
          subject: `📦 Pedido Enviado - #${order.orderNumber} - Rastreamento: ${trackingNumber}`,
          html: emailHTML,
          orderNumber: order.orderNumber,
          customerName: order.shippingAddress.name,
        });
      }

      if (!emailSent) {
        // Fallback to EmailJS with tracking notification
        const itemsList = order.items.map((item: any) => 
          `${item.productName} (${item.size}) x${item.quantity} - ¥${(item.price * item.quantity).toLocaleString()}`
        ).join('\n');
        
        const shippingAddress = `
${order.shippingAddress.name}
〒${order.shippingAddress.postalCode}
${order.shippingAddress.prefecture} ${order.shippingAddress.city}
${order.shippingAddress.address}
${order.shippingAddress.building || ''}
        `.trim();
        
        emailSent = await emailServiceSimple.sendTrackingNotification({
          to_email: order.customerEmail || order.shippingAddress.email,
          to_name: order.shippingAddress.name,
          order_number: order.orderNumber,
          tracking_number: trackingNumber,
          carrier_name: carrierName,
          tracking_url: trackingUrl,
          items_list: itemsList,
          total_price: `¥${order.totalPrice.toLocaleString()}`,
          shipping_address: shippingAddress,
          html_content: emailHTML,
        });
      }

      if (emailSent) {
        toast({
          title: "Email enviado!",
          description: `Notificação de envio enviada para ${order.shippingAddress.name}`,
        });
      } else {
        toast({
          title: "Aviso",
          description: "Email não pôde ser enviado, mas pedido foi marcado como enviado",
          variant: "destructive",
        });
      }

      // Send WhatsApp message if phone is available
      const customerPhone = order.customerPhone || order.shippingAddress.phone;
      if (customerPhone) {
        const whatsappMessage = `
🎉 *Seu Pedido Foi Enviado!*

Olá ${order.shippingAddress.name}!

Seu pedido #${order.orderNumber} foi enviado e está a caminho! 📦

*Transportadora:* ${carrierName}
*Código de Rastreamento:* ${trackingNumber}

${trackingUrl ? `*Rastreie seu pedido aqui:*\n${trackingUrl}\n\n` : 'Use este código para rastrear seu pedido no site da transportadora.\n\n'}*Resumo do Pedido:*
${order.items.map((item: any) => 
  `• ${item.productName} (${item.size}) - ${item.quantity}x - ¥${(item.price * item.quantity).toLocaleString()}`
).join('\n')}

*Total:* ¥${order.totalPrice.toLocaleString()}

Obrigado por comprar na *Sabor do Campo*! 🍯
        `.trim();

        try {
          await whatsappService.sendMessage({
            to: customerPhone,
            message: whatsappMessage,
          });
          
          toast({
            title: "WhatsApp enviado!",
            description: "Mensagem de rastreamento enviada via WhatsApp",
          });
        } catch (error) {
          console.error('Error sending WhatsApp:', error);
          // Don't show error toast - email was sent successfully
        }
      }

      onSuccess(trackingNumber, selectedCarrier || order.shipping?.carrier || '');
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Erro ao enviar email",
        description: "Mas o pedido foi marcado como enviado",
        variant: "destructive",
      });
      onSuccess(trackingNumber, selectedCarrier || order.shipping?.carrier || '');
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Marcar como Enviado
          </DialogTitle>
          <DialogDescription>
            Pedido #{order?.orderNumber} - {order?.shippingAddress.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="tracking">Número de Rastreamento *</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              placeholder="Ex: JP123456789BR"
              className="mt-2"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Digite o código de rastreamento da transportadora
            </p>
          </div>

          <div>
            <Label htmlFor="carrier">Transportadora *</Label>
            <select
              id="carrier"
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione a transportadora</option>
              <option value="Yamato">Yamato Transport (クロネコヤマト)</option>
              <option value="Sagawa">Sagawa Express (佐川急便)</option>
              <option value="Japan Post">Japan Post (日本郵便)</option>
              <option value="Fukutsu">Fukutsu Express (福山通運)</option>
            </select>
            {order?.shipping?.carrier && (
              <p className="text-xs text-muted-foreground mt-1">
                Transportadora do pedido: {order.shipping.carrier}
              </p>
            )}
          </div>

          <div className="bg-secondary/30 rounded-lg p-4 text-sm space-y-2">
            <p><strong>O que acontecerá:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Status do pedido será atualizado para "Enviado"</li>
              <li>Cliente receberá email com o número de rastreamento</li>
              <li>Email incluirá resumo completo do pedido</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSending || !trackingNumber.trim() || !selectedCarrier}
            className="gap-2"
          >
            {isSending ? (
              <>Enviando...</>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Confirmar Envio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrackingModal;
