import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Truck, CheckCircle, XCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface OrderStatus {
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  label: string;
  icon: React.ReactNode;
  color: string;
  date?: string;
}

const TrackOrder: React.FC = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const statusFlow: OrderStatus[] = [
    { status: 'pending', label: 'Pendente', icon: <Package className="w-6 h-6" />, color: 'text-yellow-500' },
    { status: 'processing', label: 'Processando', icon: <Package className="w-6 h-6" />, color: 'text-blue-500' },
    { status: 'shipped', label: 'Enviado', icon: <Truck className="w-6 h-6" />, color: 'text-purple-500' },
    { status: 'delivered', label: 'Entregue', icon: <CheckCircle className="w-6 h-6" />, color: 'text-green-500' },
  ];

  const handleSearch = () => {
    if (!orderNumber.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite um número de pedido',
        variant: 'destructive'
      });
      return;
    }

    // Buscar em todos os usuários
    const allUsers = Object.keys(localStorage)
      .filter(key => key.startsWith('orders_'))
      .map(key => localStorage.getItem(key))
      .filter(Boolean)
      .flatMap(data => JSON.parse(data as string));

    const order = allUsers.find((o: any) => o.orderNumber === orderNumber.toUpperCase());

    if (!order) {
      toast({
        title: 'Pedido não encontrado',
        description: 'Verifique o número e tente novamente',
        variant: 'destructive'
      });
      return;
    }

    setSearchedOrder(order);
  };

  const getStatusIndex = (status: string) => {
    return statusFlow.findIndex(s => s.status === status);
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Rastrear Pedido
            </h1>
            <p className="text-muted-foreground text-lg">
              Digite o número do seu pedido para acompanhar o status
            </p>
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Search */}
          <div className="bg-card rounded-2xl border border-border p-8 mb-8">
            <div className="flex gap-3">
              <Input
                placeholder="Ex: DL-12345678"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 text-lg"
              />
              <Button onClick={handleSearch} size="lg">
                <Search className="w-5 h-5 mr-2" />
                Rastrear
              </Button>
            </div>
          </div>

          {/* Order Details */}
          {searchedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="bg-card rounded-2xl border border-border p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold mb-2">
                      Pedido {searchedOrder.orderNumber}
                    </h2>
                    <p className="text-muted-foreground">
                      Realizado em {new Date(searchedOrder.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">
                      ¥{searchedOrder.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">{searchedOrder.paymentMethod === 'bank' ? 'Depósito' : 'PayPay'}</p>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative">
                  <div className="absolute top-8 left-8 h-full w-0.5 bg-border"></div>
                  
                  {statusFlow.map((step, index) => {
                    const currentIndex = getStatusIndex(searchedOrder.status);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    const isCancelled = searchedOrder.status === 'cancelled';

                    return (
                      <div key={step.status} className="relative flex items-start gap-6 pb-8 last:pb-0">
                        <div className={cn(
                          "relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-4 bg-card transition-all",
                          isCompleted && !isCancelled ? 'border-green-500 text-green-500' :
                          isCurrent && !isCancelled ? 'border-blue-500 text-blue-500 animate-pulse' :
                          'border-gray-300 text-gray-300'
                        )}>
                          {step.icon}
                        </div>

                        <div className="flex-1 pt-3">
                          <h3 className={cn(
                            "font-semibold text-lg mb-1",
                            isCompleted && !isCancelled ? 'text-foreground' : 'text-muted-foreground'
                          )}>
                            {step.label}
                          </h3>
                          {isCurrent && (
                            <p className="text-sm text-blue-600 font-medium">Status atual</p>
                          )}
                          {isCompleted && index < currentIndex && (
                            <p className="text-sm text-green-600">✓ Concluído</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Cancelled Status */}
                  {searchedOrder.status === 'cancelled' && (
                    <div className="relative flex items-start gap-6">
                      <div className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-4 border-red-500 text-red-500 bg-card">
                        <XCircle className="w-6 h-6" />
                      </div>
                      <div className="flex-1 pt-3">
                        <h3 className="font-semibold text-lg mb-1 text-red-600">Cancelado</h3>
                        <p className="text-sm text-muted-foreground">O pedido foi cancelado</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="bg-card rounded-2xl border border-border p-8">
                <h3 className="font-semibold text-lg mb-4">Produtos</h3>
                <div className="space-y-3">
                  {searchedOrder.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-3 border-b last:border-0">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">{item.size} × {item.quantity}</p>
                      </div>
                      <p className="font-semibold">¥{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-card rounded-2xl border border-border p-8">
                <h3 className="font-semibold text-lg mb-4">Endereço de Entrega</h3>
                <p className="text-foreground">
                  {searchedOrder.shippingAddress.name}<br />
                  〒{searchedOrder.shippingAddress.postalCode}<br />
                  {searchedOrder.shippingAddress.prefecture} {searchedOrder.shippingAddress.city}<br />
                  {searchedOrder.shippingAddress.address}
                  {searchedOrder.shippingAddress.building && <><br />{searchedOrder.shippingAddress.building}</>}
                </p>
              </div>
            </div>
          )}

          {!searchedOrder && (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                Digite um número de pedido para rastrear
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default TrackOrder;
