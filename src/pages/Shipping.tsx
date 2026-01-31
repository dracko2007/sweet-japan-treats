import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, Clock, Shield, ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { Button } from '@/components/ui/button';

const Shipping: React.FC = () => {
  const carriers = [
    {
      name: 'Japan Post (ゆうパック)',
      logo: '📮',
      description: 'Serviço postal tradicional com cobertura nacional completa.',
      features: ['Tracking online', 'Entrega nos correios', 'Horário flexível']
    },
    {
      name: 'Yamato (クロネコヤマト)',
      logo: '🐱',
      description: 'O gato preto mais famoso do Japão, conhecido pela qualidade.',
      features: ['Entrega expressa', 'Serviço noturno', 'Reagendamento fácil']
    },
    {
      name: 'Sagawa (佐川急便)',
      logo: '📦',
      description: 'Confiabilidade e eficiência na entrega em todo o país.',
      features: ['Preços competitivos', 'Entregas rápidas', 'Suporte em japonês']
    }
  ];

  const faqItems = [
    {
      question: 'Quanto tempo demora a entrega?',
      answer: 'O tempo varia de acordo com a sua localização. Para regiões próximas a Mie (Kansai e Chubu), a entrega leva de 1 a 2 dias úteis. Para regiões mais distantes como Hokkaido e Okinawa, pode levar de 3 a 4 dias úteis.'
    },
    {
      question: 'Como são embalados os produtos?',
      answer: 'Utilizamos caixas de 60cm para pedidos menores (até 8 potes pequenos) e caixas de 80cm para pedidos maiores. Cada pote é cuidadosamente protegido com material de enchimento para garantir que chegue em perfeitas condições.'
    },
    {
      question: 'Posso escolher a transportadora?',
      answer: 'Sim! Mostramos todas as opções disponíveis com seus respectivos preços para que você possa escolher a que melhor atende suas necessidades.'
    },
    {
      question: 'O que acontece se o produto chegar danificado?',
      answer: 'Garantimos a qualidade dos nossos produtos. Caso ocorra algum problema durante o transporte, entre em contato conosco imediatamente e providenciaremos a reposição ou reembolso.'
    }
  ];

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Frete e Entrega
            </h1>
            <p className="text-muted-foreground text-lg">
              Enviamos para todas as 47 prefeituras do Japão. Calcule o frete para sua região 
              e escolha a transportadora de sua preferência.
            </p>
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Calculator */}
            <div>
              <ShippingCalculator />
              
              <div className="mt-6 p-4 bg-secondary/50 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  <strong>💡 Dica:</strong> Adicione produtos ao carrinho para calcular o frete 
                  com base no tamanho das caixas necessárias.
                </p>
                <Button asChild variant="link" className="mt-2 p-0 h-auto text-primary">
                  <Link to="/produtos">
                    Ver produtos
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="space-y-8">
              {/* Carriers */}
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  Nossas Transportadoras
                </h2>
                <div className="space-y-4">
                  {carriers.map((carrier) => (
                    <div key={carrier.name} className="p-4 rounded-xl bg-card border border-border">
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{carrier.logo}</span>
                        <div>
                          <h3 className="font-semibold text-foreground">{carrier.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{carrier.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {carrier.features.map((feature) => (
                              <span key={feature} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box Info */}
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Tamanhos de Caixa
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="font-medium text-foreground min-w-[60px]">60cm:</span>
                    <span className="text-muted-foreground">
                      Até 8 potes pequenos (280g) ou 1 grande + 1 pequeno
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-medium text-foreground min-w-[60px]">80cm:</span>
                    <span className="text-muted-foreground">
                      Até 3 potes grandes (800g) ou 2 grandes + 2 pequenos
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t border-primary/10">
                    * 1 pote grande equivale a 2 potes pequenos em espaço
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <h2 className="font-display text-2xl font-bold text-foreground mb-8 text-center">
              Perguntas Frequentes
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {faqItems.map((item) => (
                <div key={item.question} className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Shipping;
