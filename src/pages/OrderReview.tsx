import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ArrowRight, Printer, CreditCard, Building2, Smartphone, MapPin, User, Phone, Mail, CheckCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface OrderReviewProps {
  formData?: {
    name: string;
    email: string;
    phone: string;
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building: string;
  };
}

const OrderReview: React.FC = () => {
  const { items, totalPrice } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const formData = location.state?.formData;
  const shipping = location.state?.shipping;
  const couponDiscount = location.state?.couponDiscount || 0;
  const appliedCoupon = location.state?.coupon;
  const [paymentMethod, setPaymentMethod] = useState('bank');

  // Redirect if no form data or shipping
  React.useEffect(() => {
    if (!formData || !shipping) {
      navigate('/checkout');
    }
  }, [formData, shipping, navigate]);

  if (!formData || !shipping) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmOrder = () => {
    navigate('/order-confirmation', { 
      state: { 
        formData, 
        paymentMethod,
        shipping,
        items,
        totalPrice,
        couponDiscount,
        appliedCoupon
      } 
    });
  };

  // Fixed sender address
  const senderAddress = {
    name: 'Paula Shiokawa',
    postalCode: '518-0225',
    prefecture: '三重県',
    city: '伊賀市',
    address: '桐ヶ丘 5-292',
    phone: '070-1367-1679'
  };

  return (
    <Layout>
      <div className="gradient-hero py-16 print:hidden">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Revisar Pedido
            </h1>
            <p className="text-muted-foreground text-lg">
              Verifique todos os dados antes de finalizar
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Print Button */}
            <div className="flex justify-end print:hidden">
              <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer className="w-4 h-4" />
                Imprimir Recibo
              </Button>
            </div>

            {/* Order Summary */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Produtos do Pedido
                </h2>
              </div>

              <div className="space-y-4">
                {items.map((item) => (
                  <div 
                    key={`${item.product.id}-${item.size}`}
                    className="flex items-center gap-4 pb-4 border-b border-border last:border-0"
                  >
                    <img 
                      src={item.product.image} 
                      alt={item.product.name}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Tamanho: {item.size} • Quantidade: {item.quantity}x
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Preço unitário: ¥{item.product.prices[item.size].toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-foreground">
                        ¥{(item.product.prices[item.size] * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="pt-4 space-y-2">
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">¥{totalPrice.toLocaleString()}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-base text-green-600">
                      <span>Desconto {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                      <span className="font-semibold">-¥{couponDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Frete ({shipping.carrier})</span>
                    <span className="font-semibold">¥{shipping.cost.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    Entrega em {shipping.estimatedDays} dias úteis
                  </div>
                  <div className="flex justify-between pt-3 border-t border-border">
                    <span className="font-bold text-xl">Total</span>
                    <span className="font-bold text-2xl text-primary">
                      ¥{(totalPrice - couponDiscount + shipping.cost).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Dados do Cliente
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nome
                  </Label>
                  <p className="font-medium text-foreground">{formData.name}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </Label>
                  <p className="font-medium text-foreground">{formData.phone}</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <p className="font-medium text-foreground">{formData.email}</p>
                </div>
              </div>
            </div>

            {/* Shipping Address - Destinatário APENAS */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Endereço de Entrega (Destinatário)
                </h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Nome Completo</Label>
                  <p className="font-semibold text-lg text-foreground">{formData.name}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">CEP</Label>
                    <p className="font-medium text-foreground">〒{formData.postalCode}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Província</Label>
                    <p className="font-medium text-foreground">{formData.prefecture}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Cidade</Label>
                  <p className="font-medium text-foreground">{formData.city}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Endereço</Label>
                  <p className="font-medium text-foreground">{formData.address}</p>
                </div>
                {formData.building && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Edifício/Apartamento</Label>
                    <p className="font-medium text-foreground">{formData.building}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground text-sm">Telefone</Label>
                  <p className="font-medium text-foreground">{formData.phone}</p>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 print:hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Forma de Pagamento
                </h2>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
                    <RadioGroupItem value="bank" id="bank" className="mt-1" />
                    <Label htmlFor="bank" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        <span className="font-semibold">Depósito Bancário</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Transferência direta para conta bancária
                      </p>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
                    <RadioGroupItem value="paypay" id="paypay" className="mt-1" />
                    <Label htmlFor="paypay" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="w-5 h-5 text-primary" />
                        <span className="font-semibold">PayPay</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Pagamento via aplicativo PayPay
                      </p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 print:hidden">
              <Button 
                variant="outline" 
                onClick={() => navigate('/checkout', { state: { formData } })}
                className="flex-1 rounded-xl py-6 text-lg"
              >
                Voltar e Editar
              </Button>
              <Button 
                onClick={handleConfirmOrder}
                className="flex-1 btn-primary rounded-xl py-6 text-lg font-semibold"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirmar e Finalizar
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
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

export default OrderReview;
