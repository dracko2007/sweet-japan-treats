import React from 'react';
import { Link } from 'react-router-dom';
import { Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-[90vh] gradient-hero overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-caramel-light/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
          {/* Content */}
          <div className="space-y-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Feito artesanalmente no Japão
            </div>
            
            <h1 className="font-display text-5xl lg:text-7xl font-bold leading-tight text-foreground">
              O verdadeiro sabor do{' '}
              <span className="text-gradient">doce de leite</span>{' '}
              brasileiro
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Produzido com ingredientes selecionados e técnicas tradicionais, 
              nosso doce de leite traz toda a cremosidade e sabor que você 
              conhece e ama, direto de Mie para todo o Japão.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="btn-primary rounded-full px-8 text-base">
                <Link to="/produtos">
                  Ver Produtos
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base border-2">
                <Link to="/sobre">
                  Nossa História
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 pt-4">
              <div>
                <p className="font-display text-3xl font-bold text-foreground">100%</p>
                <p className="text-sm text-muted-foreground">Artesanal</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className="font-display text-3xl font-bold text-foreground">7+</p>
                <p className="text-sm text-muted-foreground">Sabores</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className="font-display text-3xl font-bold text-foreground">47</p>
                <p className="text-sm text-muted-foreground">Províncias</p>
              </div>
            </div>
          </div>

          {/* Video Section */}
          <div className="relative animate-fade-in">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-elevated bg-card">
              {/* Video Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-caramel-light/30 to-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <button className="group w-24 h-24 rounded-full gradient-caramel shadow-elevated flex items-center justify-center transition-transform hover:scale-110">
                    <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
                  </button>
                  <p className="mt-6 font-display text-lg text-foreground">Assista nosso preparo</p>
                  <p className="text-sm text-muted-foreground mt-1">Veja como fazemos o doce de leite</p>
                </div>
              </div>

              {/* Decorative border */}
              <div className="absolute inset-0 border-4 border-primary/20 rounded-3xl pointer-events-none" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-card rounded-2xl shadow-card p-4 animate-float">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">🇧🇷</span>
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">Receita Brasileira</p>
                  <p className="text-xs text-muted-foreground">Tradição desde sempre</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
