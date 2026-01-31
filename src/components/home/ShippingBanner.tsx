import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, MapPin, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ShippingBanner: React.FC = () => {
  const features = [
    {
      icon: Truck,
      title: '3 Transportadoras',
      description: 'Yuubin, Yamato e Sagawa'
    },
    {
      icon: MapPin,
      title: 'Todo Japão',
      description: 'De Hokkaido a Okinawa'
    },
    {
      icon: Package,
      title: 'Embalagem Segura',
      description: 'Proteção garantida'
    },
    {
      icon: Clock,
      title: 'Entrega Rápida',
      description: '1-3 dias úteis'
    }
  ];

  return (
    <section className="py-20 gradient-caramel text-primary-foreground relative overflow-hidden">
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} 
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl lg:text-5xl font-bold mb-4">
            Enviamos para todo o Japão
          </h2>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto text-lg">
            Saindo de Mie, calculamos o frete automaticamente 
            para sua localização com as melhores transportadoras do país.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-primary-foreground/15 transition-colors"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-14 h-14 rounded-full bg-primary-foreground/20 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-primary-foreground/70">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" variant="secondary" className="rounded-full px-8 text-base font-semibold">
            <Link to="/frete">
              Calcular meu frete
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ShippingBanner;
