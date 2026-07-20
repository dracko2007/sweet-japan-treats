import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, ArrowDown, PlaneTakeoff, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLenis } from '@/lib/smoothScroll';

gsap.registerPlugin(ScrollTrigger);

/** Item da prateleira cinematográfica. */
interface ShelfProduct {
  id: string;
  brand: string;
  name: string;
  nameJa: string;
  description: string;
  price: string;
  image: string;
  bgKanji: string;
  accent: string;
  link: string;
}

/**
 * Curadoria de produtos reais do catálogo Japan Express (feed do merchant).
 * Imagens baixadas do Cloudinary da loja para /public/cinematic.
 * Fino (máscara + óleo + kit) e &honey (shampoo + tratamento + óleo + pack).
 */
const PRODUCTS: ShelfProduct[] = [
  {
    id: 'fino-mask',
    brand: 'Fino · Premium Touch',
    name: 'Hair Mask',
    nameJa: 'ヘアマスク',
    description:
      'Máscara de tratamento intensivo que hidrata profundamente e repara fios danificados por química e calor.',
    price: '¥1.440',
    image: '/cinematic/fino-hair-mask.jpg',
    bgKanji: '髪',
    accent: '#a16207',
    link: '/produtos/cosmeticos',
  },
  {
    id: 'honey-melty',
    brand: '&honey · Melty Moist',
    name: 'Shampoo + Tratamento',
    nameJa: 'シャンプー ＆ トリートメント',
    description:
      'Shampoo e condicionador com mel, óleos botânicos e ácido hialurônico. Hidratação intensa do conteúdo ao refil.',
    price: '¥5.400',
    image: '/cinematic/honey-melty.jpg',
    bgKanji: '蜜',
    accent: '#db7c2c',
    link: '/produtos/cosmeticos',
  },
  {
    id: 'fino-oil',
    brand: 'Fino · Premium Touch',
    name: 'Hair Oil',
    nameJa: 'ヘアオイル',
    description:
      'Óleo capilar que nutre, controla o frizz e traz brilho intenso sem pesar os fios.',
    price: '¥2.340',
    image: '/cinematic/fino-hair-oil.jpg',
    bgKanji: '油',
    accent: '#a16207',
    link: '/produtos/cosmeticos',
  },
  {
    id: 'honey-pixie',
    brand: '&honey · Pixie Moist',
    name: 'Silky Hair Oil',
    nameJa: 'ヘアオイル',
    description:
      'Óleo leve com mel e ácido hialurônico para fios sedosos, alinhados e com movimento natural.',
    price: '¥3.200',
    image: '/cinematic/honey-pixie-oil.jpg',
    bgKanji: '蜂',
    accent: '#db7c2c',
    link: '/produtos/cosmeticos',
  },
  {
    id: 'fino-kit',
    brand: 'Fino · Kit',
    name: 'Shampoo + Condicionador',
    nameJa: 'デイリーケア',
    description:
      'Rotina diária com sérum de beleza para cabelos macios, brilhantes e saudáveis todos os dias.',
    price: '¥6.000',
    image: '/cinematic/fino-kit.jpg',
    bgKanji: '髪',
    accent: '#a16207',
    link: '/produtos/cosmeticos',
  },
  {
    id: 'honey-milky',
    brand: '&honey · Milky Precious',
    name: 'Repair Hair Pack',
    nameJa: 'ヘアパック',
    description:
      'Máscara com mel e leite para reparação profunda, redução de frizz e maciez duradoura.',
    price: '¥2.400',
    image: '/cinematic/honey-milky-pack.jpg',
    bgKanji: '蜜',
    accent: '#db7c2c',
    link: '/produtos/cosmeticos',
  },
];

const TOTAL_PANELS = PRODUCTS.length + 2; // intro + produtos + encerramento

export type CinematicIntroVariant = 'original' | 'transition';

interface CinematicHeroShelfProps {
  introVariant?: CinematicIntroVariant;
}

interface IntroVideoConfig {
  src: string;
  poster: string;
  overlayExitAtSeconds: number;
  restartHoldMs: number;
  introDwellMs: number;
  showOverlayLogo: boolean;
}

/**
 * A versão original continua sendo o padrão. A alternativa combina o travelling
 * com a vinheta rosa; nela, o texto e os overlays saem antes do crossfade para
 * deixar a animação da própria Japan Express ocupar a tela sem marca duplicada.
 */
const INTRO_VIDEOS: Record<CinematicIntroVariant, IntroVideoConfig> = {
  original: {
    src: '/videos/hero-intro.mp4',
    poster: '/videos/hero-intro-poster.jpg',
    overlayExitAtSeconds: 7,
    restartHoldMs: 2600,
    introDwellMs: 11000,
    showOverlayLogo: true,
  },
  transition: {
    src: '/videos/hero-store-transition.mp4',
    poster: '/videos/hero-intro-poster.jpg',
    overlayExitAtSeconds: 5.6,
    restartHoldMs: 2600,
    introDwellMs: 19000,
    showOverlayLogo: false,
  },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * CinematicHeroShelf
 *
 * Seção hero premium com scroll-driven motion: a página é pinneada enquanto uma
 * track horizontal de painéis desliza da direita para a esquerda, simulando uma
 * passagem por uma prateleira de produtos de beleza. GSAP ScrollTrigger faz o
 * pin + scrub; Lenis (em SmoothScroll) dá a suavidade do scroll.
 *
 * Cada painel revela seu conteúdo (stagger) ao cruzar o centro da tela, e o
 * kanji gigante de fundo deriva em parallax para criar profundidade.
 *
 * Acessibilidade: com `prefers-reduced-motion`, renderiza os mesmos painéis em
 * coluna vertical, sem pin/transform — totalmente navegável por teclado/leitor.
 */
const CinematicHeroShelf: React.FC<CinematicHeroShelfProps> = ({
  introVariant = 'original',
}) => {
  const introVideo = INTRO_VIDEOS[introVariant];
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const stRef = useRef<ScrollTrigger | null>(null);

  // O conteúdo editorial sai no momento configurado para cada versão do vídeo.
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const logoHoldTimer = useRef<number | undefined>(undefined);
  const [logoMoment, setLogoMoment] = useState(false);

  useEffect(() => () => window.clearTimeout(logoHoldTimer.current), []);

  const handleIntroTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!logoMoment && e.currentTarget.currentTime >= introVideo.overlayExitAtSeconds) {
      setLogoMoment(true);
    }
  };

  const handleIntroEnded = () => {
    logoHoldTimer.current = window.setTimeout(() => {
      if (introVariant === 'original') setLogoMoment(false);
      const video = introVideoRef.current;
      if (video) {
        video.currentTime = 0;
        void video.play();
      }
    }, introVideo.restartHoldMs);
  };

  const reduced = prefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const track = trackRef.current;
      const section = sectionRef.current;
      if (!track || !section) return;

      // Header fixo do site: o hero pina logo abaixo dele para nunca ser
      // coberto/cortado (o pin em 'top top' deslizava o vídeo sob o header).
      const headerEl = document.querySelector<HTMLElement>('header');
      const headerH = () => headerEl?.offsetHeight ?? 0;
      const applyShelfTop = () => {
        section.style.setProperty('--shelf-top', `${headerH()}px`);
      };
      applyShelfTop();
      ScrollTrigger.addEventListener('refreshInit', applyShelfTop);

      // Distância horizontal a percorrer = largura da track além da viewport.
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

      // Tween principal: translate X amarrado ao scroll vertical (pin + scrub).
      // Sem anticipatePin: com Lenis (scroll suave) ele engata o pin um frame
      // antes e causa um salto de alguns pixels no início da seção.
      const horizontal = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: () => `top ${headerH()}px`,
          end: () => `+=${distance()}`,
          scrub: 1,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressRef.current) {
              progressRef.current.style.transform = `scaleX(${self.progress})`;
            }
            if (counterRef.current) {
              const idx = Math.min(
                TOTAL_PANELS,
                Math.floor(self.progress * TOTAL_PANELS) + 1,
              );
              counterRef.current.textContent = `${String(idx).padStart(2, '0')} / ${String(TOTAL_PANELS).padStart(2, '0')}`;
            }
          },
        },
      });
      stRef.current = horizontal.scrollTrigger ?? null;

      // Revelação por painel: containerAnimation amarra ao tween horizontal,
      // de modo que cada painel dispara seu stagger ao entrar pelo centro.
      const panels = gsap.utils.toArray<HTMLElement>('.cinematic-panel');
      panels.forEach((panel) => {
        const reveals = panel.querySelectorAll<HTMLElement>('.cinematic-reveal');
        if (!reveals.length) return;
        gsap.from(reveals, {
          opacity: 0,
          y: 50,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: panel,
            containerAnimation: horizontal,
            start: 'left 78%',
            end: 'center 55%',
            scrub: 1,
          },
        });
      });

      // Parallax suave do kanji de fundo (profundidade).
      gsap.fromTo(
        '.cinematic-kanji',
        { xPercent: -8 },
        {
          xPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: () => `top ${headerH()}px`,
            end: () => `+=${distance()}`,
            scrub: 1,
          },
        },
      );

      // Autoplay: a prateleira avança sozinha, painel a painel. Qualquer
      // interação do cliente (roda do mouse, toque, clique ou tecla) encerra
      // o automático e devolve o controle — modo manual definitivo.
      const st = horizontal.scrollTrigger;
      let manual = false;
      let autoTimer: number | undefined;

      // Aguarda o vídeo inteiro e a pausa na marca antes de avançar ao produto.
      const PANEL_DWELL_MS = 4500; // tempo parado em cada produto
      const SLIDE_DURATION_S = 1.6; // duração do deslize entre painéis

      const targetFor = (i: number) =>
        st ? Math.max(0, st.start + ((st.end - st.start) * i) / (TOTAL_PANELS - 1)) : 0;

      const schedule = (ms: number) => {
        if (manual || !st) return;
        window.clearTimeout(autoTimer);
        autoTimer = window.setTimeout(advance, ms);
      };

      const advance = () => {
        if (manual || !st || document.hidden) return;
        // Se o cliente já está além da prateleira (ex.: scroll restaurado),
        // não puxa a página de volta — vira manual.
        if (window.scrollY > st.end + 10) {
          toManual();
          return;
        }
        const current = Math.round(st.progress * (TOTAL_PANELS - 1));
        const next = Math.min(current + 1, TOTAL_PANELS - 1);
        if (next === current) return; // chegou ao fim, autoplay encerra
        const done = () => {
          if (next < TOTAL_PANELS - 1) schedule(PANEL_DWELL_MS);
        };
        const lenis = getLenis();
        if (lenis) {
          lenis.scrollTo(targetFor(next), {
            duration: SLIDE_DURATION_S,
            easing: (t: number) => 1 - Math.pow(1 - t, 3),
            onComplete: done,
          });
        } else {
          window.scrollTo({ top: targetFor(next), behavior: 'smooth' });
          window.setTimeout(done, SLIDE_DURATION_S * 1000);
        }
      };

      const toManual = () => {
        manual = true;
        window.clearTimeout(autoTimer);
      };

      const interactionEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
      interactionEvents.forEach((ev) =>
        window.addEventListener(ev, toManual, { passive: true }),
      );

      const onVisibility = () => {
        if (document.hidden) window.clearTimeout(autoTimer);
        else schedule(PANEL_DWELL_MS);
      };
      document.addEventListener('visibilitychange', onVisibility);

      schedule(introVideo.introDwellMs);

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', applyShelfTop);
        interactionEvents.forEach((ev) => window.removeEventListener(ev, toManual));
        document.removeEventListener('visibilitychange', onVisibility);
        window.clearTimeout(autoTimer);
      };
    },
    { scope: sectionRef },
  );

  const handleSkip = () => {
    const end = stRef.current?.end;
    if (typeof end === 'number') {
      window.scrollTo({ top: end + 1, behavior: 'smooth' });
    } else if (sectionRef.current) {
      window.scrollTo({
        top: sectionRef.current.offsetTop + sectionRef.current.offsetHeight,
        behavior: 'smooth',
      });
    }
  };

  const renderIntro = () => (
    <div
      key="intro"
      className={cn(
        'cinematic-panel relative flex w-screen shrink-0 items-center justify-center overflow-hidden px-4 md:px-6',
        reduced ? 'min-h-[60dvh] md:min-h-screen' : 'h-full',
      )}
    >
      {/* Sem `loop`: ao terminar, a imagem final fica em cena e o recomeço
          acontece após a pausa configurada para esta versão. */}
      <video
        ref={introVideoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src={introVideo.src}
        poster={introVideo.poster}
        autoPlay
        muted
        playsInline
        preload="auto"
        onTimeUpdate={handleIntroTimeUpdate}
        onEnded={handleIntroEnded}
        aria-hidden
      />
      {/* Os overlays preservam a leitura no travelling e saem para revelar a
          vinheta rosa sem alterar a aparência da versão original. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30 transition-opacity duration-1000',
          logoMoment && !introVideo.showOverlayLogo && 'opacity-0',
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,transparent_0%,rgba(0,0,0,0.45)_100%)] transition-opacity duration-1000',
          logoMoment && !introVideo.showOverlayLogo && 'opacity-0',
        )}
      />

      <div
        className={cn(
          'cinematic-kanji font-jp pointer-events-none absolute right-[6%] top-[8%] select-none text-[44vmin] leading-none text-white/10 transition-opacity duration-1000',
          logoMoment && !introVideo.showOverlayLogo && 'opacity-0',
        )}
      >
        美
      </div>

      {/* Momento-marca: chegando ao balcão, a logo surge no lugar do texto,
          com o avião da Japan Express decolando sobre o lockup. */}
      {introVideo.showOverlayLogo && (
        <div
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-all duration-1000 ease-out',
          logoMoment ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
        )}
        aria-hidden
      >
        <div className="relative flex flex-col items-center">
          <PlaneTakeoff className="cinematic-plane absolute -top-16 h-9 w-9 text-white drop-shadow-lg md:h-11 md:w-11" />
          <div className="flex items-center gap-3 md:gap-4">
            <img
              src="/logo.jpg"
              alt=""
              className="h-16 w-16 rounded-full border-2 border-white/70 object-cover shadow-2xl md:h-20 md:w-20"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="font-brand text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] md:text-6xl">
                Japan
              </span>
              <span className="-rotate-6 rounded-lg bg-gradient-to-r from-primary to-accent px-2 py-0.5 font-display text-2xl font-extrabold text-white shadow-lg md:px-3 md:text-4xl">
                Express
              </span>
            </div>
          </div>
        </div>
        </div>
      )}

      <div
        className={cn(
          'relative z-10 flex max-w-2xl flex-col items-center text-center transition-opacity duration-700',
          logoMoment && 'opacity-0',
        )}
      >
        <p className="cinematic-reveal font-jp mb-2 text-[10px] uppercase tracking-[0.35em] text-pink-200/90 md:mb-5 md:text-xs md:tracking-[0.5em]">
          日本の美容 · Curadoria
        </p>
        <h1 className="cinematic-reveal mb-3 font-display text-3xl font-light leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] sm:text-4xl md:mb-6 md:text-7xl">
          Beleza <span className="font-jp italic text-pink-300">Japonesa</span>
          <br />
          em cada detalhe
        </h1>
        <p className="cinematic-reveal mb-4 max-w-sm text-xs leading-relaxed text-white/80 drop-shadow line-clamp-3 md:mb-10 md:max-w-md md:text-lg md:line-clamp-none">
          Os melhores cosméticos, papelaria, acessórios e doces direto do Japão para você, com frete seguro. Veja a aba "Como Funciona" e entenda todo o processo, do pedido à entrega.
        </p>
        <div className="cinematic-reveal flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/70 md:text-xs md:tracking-[0.3em]">
          <ArrowDown className="cinematic-bob h-3 w-3" />
          <span>Role para começar</span>
        </div>
      </div>
    </div>
  );

  const renderProductPanel = (p: ShelfProduct, i: number) => (
    <div
      key={p.id}
      className={cn(
        'cinematic-panel relative flex w-screen shrink-0 items-center overflow-hidden',
        reduced ? 'min-h-[60dvh] md:min-h-screen' : 'h-full',
      )}
    >
      <div
        className={cn(
          'cinematic-kanji font-jp pointer-events-none absolute select-none text-[46vmin] leading-none',
          i % 2 === 0 ? 'left-[5%] top-[6%]' : 'right-[6%] top-[10%]',
        )}
        style={{ color: `${p.accent}12` }}
      >
        {p.bgKanji}
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(55% 45% at 50% 62%, ${p.accent}14 0%, transparent 72%)`,
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 md:flex-row md:gap-16 md:px-6">
        <div className="cinematic-reveal flex flex-1 justify-center">
          <img
            src={p.image}
            alt={`${p.brand} ${p.name}`}
            loading="lazy"
            className="cinematic-product-img h-[20vh] max-h-[180px] w-auto object-contain md:h-[58vh] md:max-h-[440px]"
          />
        </div>
        <div className="max-w-md flex-1">
          <div className="cinematic-reveal mb-2 flex items-center gap-3 md:mb-5">
            <span className="h-px w-10" style={{ background: p.accent }} />
            <span
              className="font-jp text-[10px] uppercase tracking-[0.25em] md:text-xs md:tracking-[0.35em]"
              style={{ color: p.accent }}
            >
              {p.brand}
            </span>
          </div>
          <h2 className="cinematic-reveal mb-1 font-display text-2xl font-light leading-tight text-pink-950 md:mb-3 md:text-5xl">
            {p.name}
          </h2>
          <p className="cinematic-reveal font-jp mb-2 text-sm text-pink-700/70 md:mb-5 md:text-lg">
            {p.nameJa}
          </p>
          <p className="cinematic-reveal mb-3 text-xs leading-relaxed text-pink-950/60 line-clamp-2 md:mb-7 md:text-base md:line-clamp-none">
            {p.description}
          </p>
          <div className="cinematic-reveal flex items-center gap-4 md:gap-6">
            <span className="font-display text-xl text-pink-950 md:text-2xl">{p.price}</span>
            <Link
              to={p.link}
              className="group inline-flex items-center gap-2 text-xs font-medium text-pink-700 transition-colors hover:text-pink-900 md:text-sm"
            >
              Ver produto
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOutro = () => (
    <div
      key="outro"
      className={cn(
        'cinematic-panel relative flex w-screen shrink-0 items-center justify-center overflow-hidden px-4 md:px-6',
        reduced ? 'min-h-[60dvh] md:min-h-screen' : 'h-full',
      )}
    >
      <div className="cinematic-kanji font-jp pointer-events-none absolute bottom-[6%] left-[8%] select-none text-[42vmin] leading-none">
        蜜
      </div>
      <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
        <ShoppingBag className="cinematic-reveal mb-3 h-7 w-7 text-pink-600 md:mb-6 md:h-10 md:w-10" />
        <h2 className="cinematic-reveal mb-3 font-display text-3xl font-light leading-tight text-pink-950 md:mb-5 md:text-6xl">
          Explore a coleção
          <br />
          completa
        </h2>
        <p className="cinematic-reveal mb-4 max-w-xs text-sm text-pink-950/60 md:mb-9 md:max-w-sm md:text-base">
          Cosméticos originais importados do Japão, com envio rápido e seguro
          para todo o Brasil.
        </p>
        <div className="cinematic-reveal flex flex-col gap-3 sm:flex-row">
          <Link
            to="/produtos/cosmeticos"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-6 py-2.5 text-xs font-medium text-white transition-colors hover:bg-pink-700 md:px-8 md:py-3 md:text-sm"
          >
            Ver cosméticos <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/faca-seu-pedido"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-pink-300 px-6 py-2.5 text-xs font-medium text-pink-700 transition-colors hover:bg-pink-50 md:px-8 md:py-3 md:text-sm"
          >
            Fazer meu pedido
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className={cn(
        'relative w-full overflow-hidden bg-gradient-to-b from-pink-50 via-white to-pink-50/40',
        // No smartphone, ocupa 58% da tela (cerca de 1/3 menor). Desktop
        // preserva a experiência cinematográfica em viewport completo.
        reduced
          ? ''
          : 'h-[58dvh] min-h-[420px] max-h-[520px] md:h-[calc(100dvh-var(--shelf-top,0px))] md:min-h-0 md:max-h-none',
      )}
      aria-label="Vitrine cinematográfica de cosméticos japoneses"
    >
      {/* Superfície da prateleira — persiste enquanto os produtos deslizam */}
      {!reduced && (
        <>
          <div className="cinematic-shelf-glow" aria-hidden />
          <div
            className={cn(
              'cinematic-shelf-line transition-opacity duration-1000',
              introVariant === 'transition' && logoMoment && 'opacity-0',
            )}
            aria-hidden
          />
        </>
      )}

      {/* Barra superior */}
      {!reduced && (
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-end px-4 py-3 md:px-12 md:py-5">
          <div className="flex items-center gap-4 md:gap-6">
            <span
              ref={counterRef}
              className="font-jp text-[10px] tracking-[0.3em] text-white/80 mix-blend-difference md:text-xs md:tracking-[0.35em]"
            >
              {`01 / ${String(TOTAL_PANELS).padStart(2, '0')}`}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-[10px] uppercase tracking-[0.2em] text-white/70 mix-blend-difference transition-opacity hover:opacity-100 md:text-xs md:tracking-[0.25em]"
            >
              Pular ↓
            </button>
          </div>
        </div>
      )}

      {/* Track horizontal (pin & scrub via GSAP) */}
      <div
        ref={trackRef}
        className={cn('will-change-transform', reduced ? 'flex flex-col' : 'flex h-full')}
      >
        {renderIntro()}
        {PRODUCTS.map(renderProductPanel)}
        {renderOutro()}
      </div>

      {/* Barra de progresso + dica inferior */}
      {!reduced && (
        <>
          <div className="absolute bottom-0 left-0 right-0 z-30 h-[2px] bg-pink-900/10">
            <div
              ref={progressRef}
              className="h-full origin-left bg-gradient-to-r from-pink-500 to-rose-400"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
          <div className="absolute bottom-6 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70 mix-blend-difference md:flex">
            <ArrowDown className="cinematic-bob h-3 w-3" />
            <span>Role para explorar a prateleira</span>
          </div>
        </>
      )}
    </section>
  );
};

export default CinematicHeroShelf;
