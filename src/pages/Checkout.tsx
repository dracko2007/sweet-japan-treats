import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Printer, CheckCircle2, Package, Truck } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';

interface CheckoutState {
  prefecture: string;
  prefectureJa: string;
  carrier: string;
  carrierName: string;
  carrierLogo: string;
  shippingCost: number;
  estimatedDays: string;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, totalPrice, clearCart } = useCart();
  const [checkoutData, setCheckoutData] = useState<CheckoutState | null>(null);

  useEffect(() => {
    // Get shipping data from location state
    const state = location.state as CheckoutState | undefined;
    
    if (!state || items.length === 0) {
      // Redirect back to cart if no shipping data or empty cart
      navigate('/carrinho');
      return;
    }
    
    setCheckoutData(state);
  }, [location, items.length, navigate]);

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleNewOrder = () => {
    clearCart();
    navigate('/produtos');
  };

  if (!checkoutData) {
    return null;
  }

  const total = totalPrice + checkoutData.shippingCost;

  return (
    <Layout>
      <div className="gradient-hero py-16 print:py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center print:hidden">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Pedido Confirmado!
            </h1>
            <p className="text-muted-foreground text-lg">
              Obrigado pela sua compra
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Order Summary Card */}
          <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6" />
              Resumo do Pedido
            </h2>

            {/* Items */}
            <div className="space-y-4 mb-6">
              {items.map((item) => {
                const price = item.size === 'small' ? item.product.prices.small : item.product.prices.large;
                const sizeLabel = item.size === 'small' ? '280g' : '800g';
                
                return (
                  <div key={`${item.product.id}-${item.size}`} className="flex justify-between items-start pb-4 border-b border-border last:border-0">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{item.product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Tamanho: {sizeLabel} • Quantidade: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">¥{(price * item.quantity).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">¥{price.toLocaleString()} cada</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shipping Info */}
            <div className="bg-secondary/50 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Informações de Envio
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="font-medium">{checkoutData.prefectureJa} ({checkoutData.prefecture})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transportadora:</span>
                  <span className="font-medium">{checkoutData.carrierLogo} {checkoutData.carrierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo estimado:</span>
                  <span className="font-medium">{checkoutData.estimatedDays} dias úteis</span>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (Produtos):</span>
                <span className="font-medium">¥{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete:</span>
                <span className="font-medium">¥{checkoutData.shippingCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-display text-xl font-bold text-foreground">Total:</span>
                  <span className="font-display text-2xl font-bold text-primary">
                    ¥{total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 print:hidden">
            <Button 
              onClick={handlePrintReceipt}
              variant="outline"
              className="flex-1 py-6 text-lg font-semibold rounded-xl"
            >
              <Printer className="w-5 h-5 mr-2" />
              Imprimir Recibo
            </Button>
            <Button 
              onClick={handleNewOrder}
              className="flex-1 btn-primary py-6 text-lg font-semibold rounded-xl"
            >
              <Package className="w-5 h-5 mr-2" />
              Novo Pedido
            </Button>
          </div>

          {/* Info Note */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl print:hidden">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>📝 Nota:</strong> Este é um resumo do seu pedido. Guarde este recibo para referência futura.
              Você receberá o produto no endereço indicado dentro do prazo estimado.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Checkout;
