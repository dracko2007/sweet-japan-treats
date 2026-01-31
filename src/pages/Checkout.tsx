import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';

const Checkout: React.FC = () => {
  const { items } = useCart();

  if (items.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-secondary mx-auto mb-6 flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Carrinho vazio
            </h2>
            <p className="text-muted-foreground mb-8">
              Adicione produtos para finalizar a compra
            </p>
            <Button asChild className="btn-primary rounded-full px-8">
              <Link to="/produtos">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar às Compras
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Finalizar Compra
            </h1>
            <p className="text-muted-foreground text-lg">
              Complete suas informações para receber seus doces
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <ShippingCalculator />
            
            <div className="mt-6 text-center">
              <Button asChild variant="outline">
                <Link to="/carrinho">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Carrinho
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Checkout;
