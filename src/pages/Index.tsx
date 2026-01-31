import React from 'react';
import Layout from '@/components/layout/Layout';
import HeroSection from '@/components/home/HeroSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import ShippingBanner from '@/components/home/ShippingBanner';

const Index: React.FC = () => {
  return (
    <Layout>
      <HeroSection />
      <FeaturedProducts />
      <ShippingBanner />
      
      {/* About Preview */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Nossa História
              </span>
              <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Do Brasil para o Japão, com amor
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Nascemos da saudade do sabor brasileiro. Em Mie, no coração do Japão, 
                criamos um doce de leite que une o melhor das duas culturas: a tradição 
                brasileira e a excelência japonesa.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Cada pote é preparado artesanalmente, com ingredientes cuidadosamente 
                selecionados e muito carinho. Nosso objetivo é levar esse pedacinho 
                do Brasil para a sua mesa, onde quer que você esteja no Japão.
              </p>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="font-display text-3xl font-bold text-primary">2020</p>
                  <p className="text-sm text-muted-foreground">Fundação</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="font-display text-3xl font-bold text-primary">1000+</p>
                  <p className="text-sm text-muted-foreground">Clientes</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="font-display text-3xl font-bold text-primary">⭐ 5.0</p>
                  <p className="text-sm text-muted-foreground">Avaliação</p>
                </div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-caramel-light/40 to-primary/30 flex items-center justify-center shadow-elevated">
                  <span className="text-9xl">👨‍🍳</span>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-card rounded-2xl shadow-card p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🇧🇷</span>
                    <span className="text-2xl">❤️</span>
                    <span className="text-3xl">🇯🇵</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
