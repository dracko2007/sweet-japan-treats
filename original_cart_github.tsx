import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CartItemComponent from '@/components/cart/CartItem';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';

const Cart: React.FC = () => {
  const { items, totalPrice, clearCart } = useCart();

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
            <div className="max-w-4xl mx-auto">
              {/* Cart Items */}
              <div className="space-y-4">
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
              </div>

              {/* Order Summary */}
              <div className="bg-card rounded-2xl border border-border p-6 mt-6">
                <h3 className="font-display text-lg font-semibold mb-4">Resumo do Pedido</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">¥{totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="text-muted-foreground text-sm">Calcular no checkout</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-border">
                    <span className="font-bold text-xl">Total</span>
                    <span className="font-bold text-2xl text-primary">¥{totalPrice.toLocaleString()}+</span>
                  </div>
                </div>

                <Button asChild className="w-full mt-6 btn-primary rounded-xl py-6 text-lg font-semibold">
                  <Link to="/checkout">
                    Finalizar Compra
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Frete será calculado no próximo passo
                </p>
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
