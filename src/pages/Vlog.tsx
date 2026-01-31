import React from 'react';
import { Play, Calendar, Clock, Eye } from 'lucide-react';
import Layout from '@/components/layout/Layout';

const Vlog: React.FC = () => {
  const videos = [
    {
      id: 1,
      title: 'Como fazemos o Doce de Leite Cremoso',
      description: 'Acompanhe o processo completo de preparo do nosso doce de leite tradicional, desde a seleção do leite até o ponto perfeito.',
      thumbnail: '🍯',
      duration: '12:34',
      date: '2024-01-15',
      views: '2.5K'
    },
    {
      id: 2,
      title: 'Doce de Leite de Matcha - Fusão Brasil x Japão',
      description: 'Descubra como criamos nossa receita exclusiva que une o melhor das duas culturas.',
      thumbnail: '🍵',
      duration: '8:45',
      date: '2024-01-08',
      views: '1.8K'
    },
    {
      id: 3,
      title: 'Nossa Cozinha em Mie',
      description: 'Um tour pela nossa cozinha artesanal, onde a magia acontece todos os dias.',
      thumbnail: '🏠',
      duration: '6:20',
      date: '2024-01-01',
      views: '3.2K'
    },
    {
      id: 4,
      title: 'Receitas com Doce de Leite',
      description: 'Ideias deliciosas para usar o doce de leite em sobremesas, cafés e muito mais.',
      thumbnail: '🍰',
      duration: '15:10',
      date: '2023-12-20',
      views: '4.1K'
    },
    {
      id: 5,
      title: 'História do Doce de Leite no Brasil',
      description: 'Conheça a origem e a tradição por trás dessa delícia brasileira.',
      thumbnail: '🇧🇷',
      duration: '10:55',
      date: '2023-12-10',
      views: '2.9K'
    },
    {
      id: 6,
      title: 'Embalagem e Envio - Cuidado até a sua casa',
      description: 'Veja como preparamos cada pedido com carinho para garantir que chegue perfeito.',
      thumbnail: '📦',
      duration: '7:30',
      date: '2023-12-01',
      views: '1.5K'
    }
  ];

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Nosso Vlog
            </h1>
            <p className="text-muted-foreground text-lg">
              Acompanhe nossa jornada, aprenda receitas e veja de perto 
              como fazemos o melhor doce de leite do Japão.
            </p>
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* Featured Video */}
          <div className="mb-12">
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-gradient-to-br from-caramel-light/40 to-primary/30 shadow-elevated">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <button className="group w-24 h-24 rounded-full gradient-caramel shadow-elevated flex items-center justify-center transition-transform hover:scale-110 mb-6">
                    <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
                  </button>
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {videos[0].title}
                  </h2>
                  <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
                    {videos[0].description}
                  </p>
                </div>
              </div>
              
              {/* Video info overlay */}
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-foreground/80">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {videos[0].duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {videos[0].views} views
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.slice(1).map((video) => (
              <div key={video.id} className="group card-product cursor-pointer">
                {/* Thumbnail */}
                <div className="aspect-video bg-secondary/50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-caramel-light/30 to-primary/20 flex items-center justify-center">
                    <span className="text-6xl group-hover:scale-110 transition-transform duration-300">
                      {video.thumbnail}
                    </span>
                  </div>
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20">
                    <div className="w-16 h-16 rounded-full gradient-caramel flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Duration badge */}
                  <div className="absolute bottom-3 right-3">
                    <span className="px-2 py-1 rounded bg-foreground/80 text-background text-xs font-medium">
                      {video.duration}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {video.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {video.description}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(video.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {video.views}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Subscribe CTA */}
          <div className="mt-16 text-center p-8 rounded-3xl bg-card border border-border">
            <span className="text-4xl mb-4 block">📺</span>
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">
              Não perca nenhum vídeo!
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Siga-nos nas redes sociais para acompanhar novos conteúdos, 
              receitas e novidades sobre nossos produtos.
            </p>
          <div className="flex justify-center gap-4">
            <a href="#" className="px-6 py-2.5 rounded-full bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">
              YouTube
            </a>
            <a href="#" className="px-6 py-2.5 rounded-full gradient-caramel text-primary-foreground font-medium hover:opacity-90 transition-opacity">
              Instagram
            </a>
          </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Vlog;
