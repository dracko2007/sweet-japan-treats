import React, { useState } from 'react';
import { Play, Calendar, Clock, Eye, X } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';

const Vlog: React.FC = () => {
  const { t, language } = useLanguage();
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const videos = [
    {
      id: 1,
      titleKey: 'vlog.video1.title',
      descKey: 'vlog.video1.desc',
      thumbnail: '/video/thumb_simples_recebendo.png',
      videoUrl: 'tYcA1j-fcKg',
      duration: '14:02',
      date: '2026-05-15',
      views: '12.5K'
    },
    {
      id: 2,
      titleKey: 'vlog.video2.title',
      descKey: 'vlog.video2.desc',
      thumbnail: '/video/thumb_simples_abrindo.png',
      videoUrl: '1xN5_p-lU0Y',
      duration: '12:45',
      date: '2026-05-08',
      views: '8.2K'
    },
    {
      id: 3,
      titleKey: 'vlog.video3.title',
      descKey: 'vlog.video3.desc',
      thumbnail: '/video/thumb_simples_provando.png',
      videoUrl: 'S7R97sV1w8k',
      duration: '13:28',
      date: '2026-05-01',
      views: '9.8K'
    },
    {
      id: 4,
      titleKey: 'vlog.video4.title',
      descKey: 'vlog.video4.desc',
      thumbnail: '/video/thumb_simples_cosmetico.png',
      videoUrl: '1xN5_p-lU0Y',
      duration: '12:45',
      date: '2026-04-20',
      views: '14.1K'
    },
    {
      id: 5,
      titleKey: 'vlog.video5.title',
      descKey: 'vlog.video5.desc',
      thumbnail: '',
      videoUrl: 'tYcA1j-fcKg',
      duration: '14:02',
      date: '2026-04-10',
      views: '4.9K'
    },
    {
      id: 6,
      titleKey: 'vlog.video6.title',
      descKey: 'vlog.video6.desc',
      thumbnail: '',
      videoUrl: 'S7R97sV1w8k',
      duration: '13:28',
      date: '2026-04-01',
      views: '3.5K'
    }
  ];

  // Usa o thumbnail local quando existe; senão, cai para a miniatura do YouTube.
  const getThumb = (video: { thumbnail: string; videoUrl: string }) =>
    video.thumbnail && (video.thumbnail.startsWith('/') || video.thumbnail.startsWith('http'))
      ? video.thumbnail
      : `https://img.youtube.com/vi/${video.videoUrl}/hqdefault.jpg`;

  // Links de redes sociais (configuráveis via env)
  const youtubeUrl = import.meta.env.VITE_YOUTUBE_URL || 'https://www.youtube.com';
  const instagramUrl = import.meta.env.VITE_INSTAGRAM_URL || 'https://www.instagram.com';

  const dateLocale = language === 'pt' ? 'pt-BR' : language === 'ja' ? 'ja-JP' : 'en-US';

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {t('vlog.title')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('vlog.description')}
            </p>
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* Featured Video */}
          <div className="mb-12">
            <div 
              className="relative aspect-video rounded-3xl overflow-hidden bg-cover bg-center shadow-elevated group cursor-pointer border border-border/40"
              style={{ backgroundImage: `url(${getThumb(videos[0])})` }}
              onClick={() => setPlayingVideo(videos[0].videoUrl)}
            >
              {/* Dark shading overlay */}
              <div className="absolute inset-0 bg-black/45 group-hover:bg-black/35 transition-colors duration-300" />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white px-4">
                  <button className="group w-20 h-20 rounded-full bg-white/95 text-primary shadow-elevated flex items-center justify-center transition-transform hover:scale-110 mb-5 mx-auto">
                    <Play className="w-8 h-8 text-primary fill-primary ml-1" />
                  </button>
                  <h2 className="font-display text-2xl lg:text-3xl font-bold mb-2 drop-shadow-md">
                    {t(videos[0].titleKey)}
                  </h2>
                  <p className="text-white/90 text-sm max-w-lg mx-auto leading-relaxed drop-shadow-sm">
                    {t(videos[0].descKey)}
                  </p>
                </div>
              </div>
              
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white/95">
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    {videos[0].duration}
                  </span>
                  <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Eye className="w-3.5 h-3.5" />
                    {videos[0].views} {t('vlog.views')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.slice(1).map((video) => (
              <div 
                key={video.id} 
                className="group bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                onClick={() => setPlayingVideo(video.videoUrl)}
              >
                <div className="aspect-video bg-secondary/50 relative overflow-hidden">
                  <img
                    src={getThumb(video)}
                    alt={t(video.titleKey)}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src = `https://img.youtube.com/vi/${video.videoUrl}/hqdefault.jpg`;
                    }}
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="w-14 h-14 rounded-full bg-white text-primary flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 text-primary fill-primary ml-1" />
                    </div>
                  </div>

                  <div className="absolute bottom-3 right-3">
                    <span className="px-2.5 py-1 rounded-lg bg-black/75 text-white text-[10px] font-bold">
                      {video.duration}
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {t(video.titleKey)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                      {t(video.descKey)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground border-t border-border/60 pt-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(video.date).toLocaleDateString(dateLocale)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {video.views} {t('vlog.views')}
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
              {t('vlog.subscribe')}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('vlog.subscribeDesc')}
            </p>
            <div className="flex justify-center gap-4">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 rounded-full bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors text-sm"
              >
                YouTube
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 rounded-full gradient-caramel text-primary-foreground font-medium hover:opacity-90 transition-opacity text-sm"
              >
                Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Video Modal Player */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <button 
              onClick={() => setPlayingVideo(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-primary transition-all"
              aria-label="Close video"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="aspect-video w-full bg-black">
              {(!playingVideo.startsWith('http') && !playingVideo.startsWith('/')) || playingVideo.includes('youtube.com') || playingVideo.includes('youtu.be') ? (
                <iframe
                  src={playingVideo.includes('youtube.com') || playingVideo.includes('youtu.be') 
                    ? playingVideo.replace('watch?v=', 'embed/') 
                    : `https://www.youtube.com/embed/${playingVideo}?autoplay=1&rel=0`
                  }
                  title="Video Player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              ) : (
                <video 
                  src={playingVideo} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Vlog;