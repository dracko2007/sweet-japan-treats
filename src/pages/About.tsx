import React from 'react';
import { Heart, Star, Users, Award } from 'lucide-react';
import Layout from '@/components/layout/Layout';

const About: React.FC = () => {
  const values = [
    {
      icon: Heart,
      title: 'Feito com Amor',
      description: 'Cada pote é preparado com dedicação e carinho, como se fosse para nossa própria família.'
    },
    {
      icon: Star,
      title: 'Qualidade Premium',
      description: 'Utilizamos apenas ingredientes selecionados e de alta qualidade em todas as nossas receitas.'
    },
    {
      icon: Users,
      title: 'Tradição Familiar',
      description: 'Nossas receitas passam de geração em geração, preservando o autêntico sabor brasileiro.'
    },
    {
      icon: Award,
      title: 'Excelência Japonesa',
      description: 'Combinamos a tradição brasileira com os padrões de qualidade e higiene japoneses.'
    }
  ];

  const timeline = [
    {
      year: '2018',
      title: 'O Sonho',
      description: 'A saudade do doce de leite brasileiro nos inspirou a criar nossa própria receita no Japão.'
    },
    {
      year: '2019',
      title: 'Primeiros Testes',
      description: 'Meses de experimentos para aperfeiçoar a receita com ingredientes locais.'
    },
    {
      year: '2020',
      title: 'Lançamento',
      description: 'Início das vendas para amigos e família, com feedback extremamente positivo.'
    },
    {
      year: '2021',
      title: 'Expansão',
      description: 'Começamos a enviar para todo o Japão, atendendo a demanda crescente.'
    },
    {
      year: '2023',
      title: 'Linha Premium',
      description: 'Lançamento dos sabores premium com matcha, chocolate e amêndoas.'
    },
    {
      year: '2024',
      title: 'Hoje',
      description: 'Continuamos crescendo, sempre mantendo a qualidade artesanal.'
    }
  ];

  return (
    <Layout>
      {/* Hero */}
      <div className="gradient-hero py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Quem Somos
              </span>
              <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Uma história de amor pelo doce de leite
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Somos brasileiros apaixonados pela culinária do nosso país, morando em Mie, 
                no coração do Japão. Nossa missão é levar o verdadeiro sabor do doce de leite 
                artesanal para todos os cantos deste país incrível.
              </p>
            </div>
            
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-caramel-light/40 to-primary/30 flex items-center justify-center shadow-elevated">
                <div className="text-center">
                  <span className="text-8xl block mb-4">👨‍👩‍👧</span>
                  <p className="font-display text-xl text-foreground">Família Doce de Leite</p>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-card rounded-2xl shadow-card p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏠</span>
                  <div>
                    <p className="font-display font-semibold text-sm">Mie, Japão</p>
                    <p className="text-xs text-muted-foreground">Nossa cozinha artesanal</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Nossos Valores
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              O que nos move a cada dia para entregar o melhor doce de leite do Japão.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.title} className="p-6 rounded-2xl bg-background border border-border text-center">
                <div className="w-14 h-14 rounded-full gradient-caramel flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Nossa Jornada
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Da saudade do Brasil ao sucesso no Japão.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {timeline.map((item, index) => (
              <div key={item.year} className="relative pl-8 pb-8 last:pb-0">
                {/* Line */}
                {index !== timeline.length - 1 && (
                  <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                )}
                
                {/* Dot */}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full gradient-caramel flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>

                {/* Content */}
                <div className="bg-card rounded-xl p-5 border border-border ml-4">
                  <span className="text-sm font-semibold text-primary">{item.year}</span>
                  <h3 className="font-display text-lg font-semibold text-foreground mt-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-caramel text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-bold mb-4">
            Quer experimentar?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            Prove o verdadeiro sabor do doce de leite brasileiro, 
            feito com amor aqui no Japão.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/produtos" 
              className="px-8 py-3 bg-background text-foreground rounded-full font-semibold hover:bg-background/90 transition-colors"
            >
              Ver Produtos
            </a>
            <a 
              href="mailto:contato@docedeleite.jp" 
              className="px-8 py-3 border-2 border-primary-foreground rounded-full font-semibold hover:bg-primary-foreground/10 transition-colors"
            >
              Fale Conosco
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
