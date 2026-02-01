import React, { useState } from 'react';
import { Package, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { emailService } from '@/services/emailService';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { useToast } from '@/hooks/use-toast';

interface TrackingModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (trackingNumber: string) => void;
}

const TrackingModal: React.FC<TrackingModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

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
            .tracking-number { font-size: 24px; font-weight: bold; color: #D2691E; letter-spacing: 2px; }
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
                <p style="margin: 0 0 10px 0; color: #666;">Número de Rastreamento:</p>
                <div class="tracking-number">${trackingNumber}</div>
                <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
                  Você pode rastrear seu pedido através da transportadora.
                </p>
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
        // Fallback to EmailJS
        await emailServiceSimple.sendOrderConfirmation({
          formData: {
            name: order.shippingAddress.name,
            email: order.customerEmail || order.shippingAddress.email,
            phone: order.customerPhone || '',
            postalCode: order.shippingAddress.postalCode,
            prefecture: order.shippingAddress.prefecture,
            city: order.shippingAddress.city,
            address: order.shippingAddress.address,
            building: order.shippingAddress.building || '',
          },
          items: order.items,
          totalPrice: order.totalPrice,
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          trackingNumber: trackingNumber,
        });
      }

      toast({
        title: "Email enviado!",
        description: `Notificação de envio enviada para ${order.shippingAddress.name}`,
      });

      onSuccess(trackingNumber);
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Erro ao enviar email",
        description: "Mas o pedido foi marcado como enviado",
        variant: "destructive",
      });
      onSuccess(trackingNumber);
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
            disabled={isSending || !trackingNumber.trim()}
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
