import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CartItemComponent from '@/components/cart/CartItem';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';

interface SelectedShipping {
  prefecture: string;
  prefectureJa: string;
  carrier: string;
  carrierName: string;
  carrierLogo: string;
  shippingCost: number;
  estimatedDays: string;
}

const Cart: React.FC = () => {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [selectedShipping, setSelectedShipping] = useState<SelectedShipping | null>(null);

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Carrinho de Compras
            </h1>
            <p className="text-muted-foreground text-lg">
              {items.length > 0 
                ? `Você tem ${items.length} ${items.length === 1 ? 'item' : 'itens'} no carrinho`
                : 'Seu carrinho está vazio'
              }
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          {items.length > 0 ? (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Seus Produtos
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearCart}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar carrinho
                  </Button>
                </div>

                {items.map((item) => (
                  <CartItemComponent 
                    key={`${item.product.id}-${item.size}`} 
                    item={item} 
                  />
                ))}

                {/* Order Summary (Mobile) */}
                <div className="lg:hidden bg-card rounded-2xl border border-border p-6 mt-6">
                  <h3 className="font-display text-lg font-semibold mb-4">Resumo do Pedido</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">¥{totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="text-muted-foreground">Calcule abaixo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Calculator */}
              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <ShippingCalculator onShippingSelected={setSelectedShipping} />
                  
                  <Button 
                    className="w-full mt-6 btn-primary rounded-xl py-6 text-lg font-semibold"
                    disabled={!selectedShipping}
                    onClick={() => {
                      if (selectedShipping) {
                        navigate('/checkout', { state: selectedShipping });
                      }
                    }}
                  >
                    Finalizar Compra
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  
                  {!selectedShipping && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Selecione a prefeitura e transportadora para continuar
                    </p>
                  )}
                  
                  {selectedShipping && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Total: ¥{(totalPrice + selectedShipping.shippingCost).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 rounded-full bg-secondary mx-auto mb-6 flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-muted-foreground" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Seu carrinho está vazio
              </h2>
              <p className="text-muted-foreground mb-8">
                Adicione alguns produtos deliciosos ao seu carrinho!
              </p>
              <Button asChild className="btn-primary rounded-full px-8">
                <Link to="/produtos">
                  Ver Produtos
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Cart;
