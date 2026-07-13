import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CarouselSlide {
  id: string;
  image?: string;
  videoSrc?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaLink: string;
  priceOriginal?: string;
  pricePromo?: string;
  /** 'split' = texto à esquerda, mídia à direita (produtos/promoção).
   *  'center' = mídia (logo/vídeo) centralizada, texto abaixo (slide institucional). */
  layout?: 'split' | 'center';
}

interface HeroCarouselProps {
  slides: CarouselSlide[];
  autoplay?: boolean;
  autoplayInterval?: number;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({
  slides,
  autoplay = true,
  autoplayInterval = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!autoplay || slides.length <= 1) return;
    const timer = setInterval(goToNext, autoplayInterval);
    return () => clearInterval(timer);
  }, [autoplay, autoplayInterval, goToNext, slides.length]);

  // Evita índice fora do range quando o número de slides muda (ex: promo some)
  useEffect(() => {
    if (currentIndex >= slides.length) setCurrentIndex(0);
  }, [slides.length, currentIndex]);

  if (slides.length === 0) return null;

  const goToSlide = (index: number) => setCurrentIndex(index % slides.length);
  const goToPrevious = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-white h-[400px] sm:h-[420px] md:h-[440px] shadow-elevated">
      <div className="relative w-full h-full">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const layout = slide.layout ?? 'split';

          return (
            <div
              key={slide.id}
              className={cn(
                // rounded-2xl + overflow-hidden repetidos aqui (além do container pai) evitam
                // uma costura de 1px que o Chrome desenha na borda arredondada quando um <video>
                // com opacity/transition é promovido a uma camada de composição própria.
                'absolute inset-0 rounded-2xl overflow-hidden transition-opacity duration-700 ease-in-out',
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              )}
            >
              {layout === 'center' ? (
                /* Slide institucional: vídeo/logo preenche a div inteira, texto sobreposto */
                <div className="relative w-full h-full bg-white overflow-hidden">
                  {slide.videoSrc ? (
                    <>
                      {/* Fundo: mesmo vídeo, borrado e ampliado — preenche as laterais
                          com a própria cor do vídeo em vez de deixar vazio/desuniforme. */}
                      <video
                        src={slide.videoSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-80"
                      />
                      <video
                        src={slide.videoSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={slide.image}
                        className="relative w-full h-full object-contain"
                      />
                    </>
                  ) : slide.image ? (
                    <img src={slide.image} alt={slide.title} className="absolute inset-0 w-full h-full object-contain" />
                  ) : null}

                  {/* Texto sobreposto na parte inferior, com fundo translúcido para legibilidade */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent pt-10 pb-5 px-6 sm:px-10 flex flex-col items-center text-center gap-2">
                    {slide.badge && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide shadow-md w-fit">
                        {slide.badge}
                      </span>
                    )}
                    <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-foreground drop-shadow-sm font-display leading-tight max-w-2xl">
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p className="hidden sm:block text-sm md:text-base text-muted-foreground max-w-xl line-clamp-2">
                        {slide.subtitle}
                      </p>
                    )}
                    <Link
                      to={slide.ctaLink}
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-95 w-fit mt-1"
                    >
                      {slide.ctaLabel || 'Saiba Mais'}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                /* Slide de produto/promoção: texto à esquerda, imagem à direita */
                <div className="w-full h-full flex flex-col-reverse md:flex-row items-stretch">
                  <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 md:px-12 py-4 md:py-0 min-w-0">
                    {slide.badge && (
                      <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide mb-3 shadow-md w-fit">
                        {slide.badge}
                      </span>
                    )}
                    <h2 className="text-xl sm:text-2xl md:text-4xl font-black text-foreground mb-2 drop-shadow-sm font-display leading-tight line-clamp-3">
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p className="text-sm md:text-base text-muted-foreground mb-3 max-w-xl line-clamp-2">
                        {slide.subtitle}
                      </p>
                    )}
                    {(slide.priceOriginal || slide.pricePromo) && (
                      <div className="flex items-center gap-3 mb-4">
                        {slide.priceOriginal && (
                          <span className="text-muted-foreground line-through text-sm sm:text-base">{slide.priceOriginal}</span>
                        )}
                        {slide.pricePromo && (
                          <span className="text-primary font-black text-xl sm:text-2xl">{slide.pricePromo}</span>
                        )}
                      </div>
                    )}
                    <Link
                      to={slide.ctaLink}
                      className="inline-flex items-center gap-2 self-start bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-95 w-fit"
                    >
                      {slide.ctaLabel || 'Saiba Mais'}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Imagem do produto — confinada ao lado direito, nunca cortada, sem sombra.
                      Caixa quadrada de tamanho fixo: produtos com fotos retrato ou paisagem
                      ocupam sempre a mesma área visual, em vez de variar conforme a proporção
                      original de cada foto. */}
                  <div className="relative flex-1 md:flex-[0_0_48%] flex items-center justify-center p-2 sm:p-3 min-h-[200px] bg-white">
                    <div className="relative w-full h-full max-w-[620px] max-h-[620px] aspect-square flex items-center justify-center">
                      {slide.image && (
                        <img
                          src={slide.image}
                          alt={slide.title}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 text-black" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  index === currentIndex ? 'bg-primary w-6' : 'bg-primary/30 hover:bg-primary/50 w-2'
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HeroCarousel;
