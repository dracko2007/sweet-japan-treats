import React, { useState } from 'react';
import { CreditCard, Landmark, Tag, Mail, Phone, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';

interface CheckoutFormProps {
  shippingCost: number;
  selectedCarrier?: string;
  selectedDeliveryTime?: string;
  prefecture?: string;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ 
  shippingCost, 
  selectedCarrier,
  selectedDeliveryTime,
  prefecture 
}) => {
  const { totalPrice, items } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'paypal'>('deposit');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    zipCode: '',
    city: '',
    street: ''
  });

  const discount = appliedCoupon?.discount || 0;
  const total = totalPrice + shippingCost - discount;

  const handleApplyCoupon = () => {
    // Mock coupon validation - in real app, this would call an API
    const mockCoupons: Record<string, number> = {
      'WELCOME10': 500,
      'BIRTHDAY20': 1000,
      'SUMMER15': 750,
    };

    const discountAmount = mockCoupons[couponCode.toUpperCase()];
    
    if (discountAmount) {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: discountAmount });
      toast.success(`Cupom ${couponCode.toUpperCase()} aplicado! Desconto de ¥${discountAmount}`);
    } else {
      toast.error('Cupom inválido ou expirado');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Cupom removido');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone || !prefecture) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (items.length === 0) {
      toast.error('Seu carrinho está vazio');
      return;
    }

    // Mock order submission
    const orderData = {
      items,
      customerInfo: {
        ...customerInfo,
        prefecture
      },
      paymentMethod,
      shippingCost,
      discount,
      total,
      carrier: selectedCarrier,
      deliveryTime: selectedDeliveryTime,
      coupon: appliedCoupon?.code
    };

    console.log('Order submitted:', orderData);
    
    // In a real app, this would:
    // 1. Send order to backend
    // 2. Send WhatsApp notification
    // 3. Send email confirmation
    // 4. Redirect to payment or confirmation page
    
    toast.success('Pedido realizado com sucesso! Você receberá confirmação por email e WhatsApp.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Informações do Cliente
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
              placeholder="Seu nome"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email">
              <Mail className="w-4 h-4 inline mr-1" />
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
              placeholder="seu@email.com"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="phone">
              <Phone className="w-4 h-4 inline mr-1" />
              Telefone/WhatsApp *
            </Label>
            <Input
              id="phone"
              type="tel"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
              placeholder="090-1234-5678"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="zipCode">
              <MapPin className="w-4 h-4 inline mr-1" />
              CEP (〒)
            </Label>
            <Input
              id="zipCode"
              value={customerInfo.zipCode}
              onChange={(e) => setCustomerInfo({ ...customerInfo, zipCode: e.target.value })}
              placeholder="123-4567"
            />
          </div>
          
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={customerInfo.city}
              onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
              placeholder="Cidade"
            />
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="street">Endereço completo</Label>
            <Input
              id="street"
              value={customerInfo.street}
              onChange={(e) => setCustomerInfo({ ...customerInfo, street: e.target.value })}
              placeholder="Rua, número, apartamento"
            />
          </div>
        </div>
      </div>

      {/* Coupon Code */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5" />
          Cupom de Desconto
        </h3>
        
        {appliedCoupon ? (
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                Cupom {appliedCoupon.code} aplicado!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Desconto: ¥{appliedCoupon.discount.toLocaleString()}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCoupon}>
              Remover
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Digite seu cupom"
              className="flex-1"
            />
            <Button type="button" onClick={handleApplyCoupon} variant="outline">
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Forma de Pagamento
        </h3>
        
        <RadioGroup value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as 'deposit' | 'paypal')}>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="deposit" id="deposit" />
              <Label htmlFor="deposit" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Landmark className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Depósito Bancário</p>
                    <p className="text-sm text-muted-foreground">
                      Transferência para conta bancária
                    </p>
                  </div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="paypal" id="paypal" />
              <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5" />
                  <div>
                    <p className="font-medium">PayPal</p>
                    <p className="text-sm text-muted-foreground">
                      Pagamento seguro via PayPal
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Order Summary */}
      <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-6 border border-primary/20">
        <h3 className="font-semibold text-lg mb-4">Resumo do Pedido</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">¥{totalPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frete</span>
            <span className="font-medium">¥{shippingCost.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Desconto</span>
              <span className="font-medium">-¥{discount.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">¥{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full btn-primary py-6 text-lg font-semibold">
        Finalizar Pedido
      </Button>
      
      <p className="text-center text-xs text-muted-foreground">
        Ao finalizar o pedido, você receberá a confirmação por email e WhatsApp com os detalhes de envio
      </p>
    </form>
  );
};

export default CheckoutForm;
