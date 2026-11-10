import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

const STEPS = ['s1', 's2', 's3'] as const;
const VIDEO = '/videos/scroll-store.mp4';
const VIDEO_MOBILE = '/videos/scroll-store-mobile.mp4';
const POSTER = '/videos/scroll-store-poster.jpg';

/**
 * Cena cinematográfica: a rolagem da página "anda" pelo vídeo da loja (o vídeo
 * não toca sozinho — o tempo dele acompanha o scroll) e painéis de vidro contam
 * a história em três passos.
 *
 * - `position: sticky` puro, sem pin de biblioteca: funciona com o Lenis e no iOS.
 * - O vídeo só é baixado quando a seção chega perto da tela.
 * - Nada de `setState` por quadro: tempo do vídeo e barra de progresso são
 *   escritos direto no DOM; o React só re-renderiza quando o passo muda.
 * - Com "reduzir movimento": imagem parada e os três textos empilhados.
 */
const ScrollCinema: React.FC = () => {
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [step, setStep] = useState(0);
  const [mobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Baixa o vídeo só quando a seção está chegando.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || reduce) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '800px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduce]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || reduce) return;
    let frame = 0;
    let shown = 0; // tempo já aplicado ao vídeo (suavizado)

    const tick = () => {
      frame = 0;
      const rect = wrap.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      setStep(Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length)));

      const video = videoRef.current;
      const duration = video?.duration;
      if (video && duration && Number.isFinite(duration)) {
        const target = progress * (duration - 0.05);
        shown += (target - shown) * 0.25;
        if (Math.abs(target - shown) < 0.01) shown = target;
        if (!video.seeking && Math.abs(video.currentTime - shown) > 0.03) video.currentTime = shown;
        // Continua até o vídeo alcançar a posição da rolagem.
        if (shown !== target || video.seeking) frame = requestAnimationFrame(tick);
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(tick); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce, near]);

  if (reduce) {
    return (
      <section className="relative overflow-hidden bg-pink-50 py-12">
        <img src={POSTER} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="container relative mx-auto grid gap-4 px-4 md:grid-cols-3">
          {STEPS.map((key) => (
            <div key={key} className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-pink-500">{t(`scrollCinema.${key}.eyebrow`)}</p>
              <h3 className="mt-2 font-display text-xl font-bold text-slate-900">{t(`scrollCinema.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(`scrollCinema.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const key = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <section ref={wrapRef} className="relative h-[260vh] md:h-[320vh]" aria-label={t('scrollCinema.label')}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-pink-50">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={near ? (mobile ? VIDEO_MOBILE : VIDEO) : undefined}
          poster={POSTER}
          muted
          playsInline
          preload="auto"
          // iOS só libera o `currentTime` depois de um play: toca e pausa na hora.
          onLoadedMetadata={(e) => { const v = e.currentTarget; v.play().then(() => v.pause()).catch(() => {}); }}
          aria-hidden
        />
        {/* Luz: véu claro embaixo para o painel ler bem + brilhos rosados da marca. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-white/5 to-white/20" aria-hidden />
        {/* No celular os brilhos tingiam o vídeo inteiro de rosa: ficam só em telas largas. */}
        <div className="pointer-events-none absolute -left-24 bottom-0 hidden h-96 w-96 rounded-full bg-pink-300/40 blur-3xl md:block" aria-hidden />
        <div className="pointer-events-none absolute -right-20 top-24 hidden h-80 w-80 rounded-full bg-fuchsia-300/30 blur-3xl md:block" aria-hidden />

        <div className="absolute inset-x-0 bottom-24 px-4 md:bottom-14">
          <div className="container mx-auto">
            <div className="relative max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white/60 p-6 shadow-[0_24px_70px_-24px_rgba(219,39,119,0.45)] backdrop-blur-xl md:p-8">
              {/* Reflexo de vidro */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" aria-hidden />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-pink-500">{t(`scrollCinema.${key}.eyebrow`)}</p>
                  <h2 className="mt-2 bg-gradient-to-r from-slate-900 via-pink-700 to-fuchsia-600 bg-clip-text font-display text-2xl font-bold leading-tight text-transparent md:text-4xl">
                    {t(`scrollCinema.${key}.title`)}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">{t(`scrollCinema.${key}.text`)}</p>
                  {last && (
                    <Link
                      to="/produtos"
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/30 transition-transform hover:scale-[1.03] active:scale-95"
                    >
                      {t('scrollCinema.cta')} <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex gap-1.5">
                  {STEPS.map((id, index) => (
                    <span key={id} className={cn('h-1.5 rounded-full transition-all duration-500', index === step ? 'w-6 bg-pink-600' : 'w-1.5 bg-pink-300/70')} />
                  ))}
                </div>
                <div className="h-px flex-1 overflow-hidden rounded-full bg-pink-200/70">
                  <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-pink-500 to-fuchsia-500" style={{ transform: 'scaleX(0)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScrollCinema;
