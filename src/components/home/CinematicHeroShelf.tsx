import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, ArrowDown, PlaneTakeoff, ShoppingBag, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLenis } from '@/lib/smoothScroll';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { convertYen } from '@/services/fxService';
import { useProducts } from '@/context/ProductsContext';
import type { Product } from '@/types';
import type { ActivePromo } from '@/types/promotion';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

gsap.registerPlugin(ScrollTrigger);

/** Item da prateleira cinematográfica. */
interface ShelfProduct {
  id: string;
  brand: string;
  // Para a curadoria fixa (fallback) usamos chaves de tradução; para produtos
  // do catálogo/promo usamos nome/descrição reais já localizados.
  nameKey?: string;
  nameJa?: string;
  descriptionKey?: string;
  name?: string;
  description?: string;
  priceYen: number;
  originalPriceYen?: number; // preço cheio (promo) → riscado
  image: string;
  bgKanji: string;
  accent: string;
  link: string;
  isPromo?: boolean;
  expiresAt?: number | null;
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
    nameKey: 'cinematicHero.products.finoMask.name',
    nameJa: 'ヘアマスク',
    descriptionKey: 'cinematicHero.products.finoMask.description',
    priceYen: 1440,
    image: '/cinematic/fino-hair-mask.jpg',
    bgKanji: '髪',
    accent: '#a16207',
    link: '/produto/fino-mask',
  },
  {
    id: 'honey-melty',
    brand: '&honey · Melty Moist',
    nameKey: 'cinematicHero.products.honeyMelty.name',
    nameJa: 'シャンプー ＆ トリートメント',
    descriptionKey: 'cinematicHero.products.honeyMelty.description',
    priceYen: 5400,
    image: '/cinematic/honey-melty.jpg',
    bgKanji: '蜜',
    accent: '#db7c2c',
    link: '/produto/honey-melty',
  },
  {
    id: 'fino-kit',
    brand: 'Fino · Kit',
    nameKey: 'cinematicHero.products.finoKit.name',
    nameJa: 'デイリーケア',
    descriptionKey: 'cinematicHero.products.finoKit.description',
    priceYen: 6000,
    image: '/cinematic/fino-kit.jpg',
    bgKanji: '髪',
    accent: '#a16207',
    link: '/produto/fino-kit',
  },
];

// Kanji + acento decorativos por categoria (fundo do painel). Default cai num
// rosa neutro com o kanji 美 (beleza) — cobre categorias personalizadas.
const HERO_CATEGORY_STYLE: Record<string, { kanji: string; accent: string }> = {
  cosmeticos: { kanji: '髪', accent: '#a16207' },
  doces:      { kanji: '甘', accent: '#db2777' },
  acessorios: { kanji: '飾', accent: '#7c3aed' },
  papelaria:  { kanji: '紙', accent: '#2563eb' },
  eletronicos:{ kanji: '電', accent: '#0d9488' },
  masculino:  { kanji: '男', accent: '#1e40af' },
  vestuario:  { kanji: '着', accent: '#be185d' },
  higiene:    { kanji: '潔', accent: '#0891b2' },
  pet:        { kanji: '愛', accent: '#ca8a04' },
};
const DEFAULT_HERO_STYLE = { kanji: '美', accent: '#db2777' };
const PROMO_HERO_STYLE   = { kanji: '特', accent: '#dc2626' };
const CATEGORY_LABEL: Record<string, string> = {
  cosmeticos: 'Cosméticos', doces: 'Doces & Chás', acessorios: 'Acessórios',
  papelaria: 'Papelaria', eletronicos: 'Eletrônicos', masculino: 'Masculino',
  vestuario: 'Vestuário', higiene: 'Higiene & Saúde', pet: 'Pet',
};
const HERO_MAX_PRODUCTS = 4; // produtos sorteados por visita (além da promo)

const heroStyleFor = (category?: string) =>
  (category && HERO_CATEGORY_STYLE[category]) || DEFAULT_HERO_STYLE;

function productToShelf(p: Product, language: string): ShelfProduct {
  const { kanji, accent } = heroStyleFor(p.category);
  const loc = p.i18n?.[language];
  const priceYen = p.variants?.length
    ? Math.min(...p.variants.map((v) => Number(v.price) || 0))
    : (p.prices?.small ?? 0);
  return {
    id: p.id,
    brand: CATEGORY_LABEL[p.category] || p.category || 'Japan Express',
    name: loc?.name || p.name,
    description: loc?.description || p.description,
    priceYen,
    image: p.gallery?.[0] || p.image || p.thumbnail || '',
    bgKanji: kanji,
    accent,
    link: `/produto/${p.id}`,
  };
}

function promoToShelf(promo: ActivePromo): ShelfProduct {
  return {
    id: `promo-${promo.productId}`,
    brand: '✨ Promoção de Início',
    name: `${promo.productName} ✨`,
    description: promo.discountPct > 0 ? `${promo.discountPct}% OFF — preço promocional por tempo limitado.` : 'Preço promocional por tempo limitado.',
    priceYen: promo.promoPriceYen ?? 0,
    originalPriceYen: promo.originalPriceYen ?? undefined,
    image: promo.productImage || '',
    bgKanji: PROMO_HERO_STYLE.kanji,
    accent: PROMO_HERO_STYLE.accent,
    link: '/promocao',
    isPromo: true,
    expiresAt: promo.expiresAt,
  };
}

/** Dias inteiros restantes até `expiresAt` (arredonda para cima; null se sem prazo). */
function daysRemaining(expiresAt?: number | null): number | null {
  if (!expiresAt) return null;
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function promoCountdownLabel(days: number, language: string): string {
  if (days <= 0) return language === 'en' ? 'Ends today' : language === 'ja' ? '本日終了' : 'Termina hoje';
  if (days === 1) return language === 'en' ? 'Ends tomorrow' : language === 'ja' ? '明日終了' : 'Termina amanhã';
  if (language === 'en') return `${days} days left`;
  if (language === 'ja') return `残り${days}日`;
  return `${days} dias restantes`;
}

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
  const { language, t, selectedCountry } = useLanguage();
  const currency = getCurrencyByCountry(selectedCountry);
  const introVideo = INTRO_VIDEOS[introVariant];

  // Prateleira dinâmica: promo ativa (siteContent/homePromotion, sempre 1º
  // painel quando existe) + até 4 produtos marcados no admin (heroCarousel),
  // sorteados uma vez por visita — sem repetir. Sem nada marcado e sem promo
  // ativa, mantém a curadoria fixa (PRODUCTS) como fallback. A resolução é
  // assíncrona (Firestore) mas acontece durante o vídeo de intro — o cliente
  // só alcança os painéis de produto depois, então a troca é invisível.
  const { products, loading: productsLoading } = useProducts();
  const [shelf, setShelf] = useState<ShelfProduct[]>(PRODUCTS);
  const shelfResolved = useRef(false);
  useEffect(() => {
    if (shelfResolved.current || productsLoading) return;
    let cancelled = false;
    (async () => {
      let activePromo: ActivePromo | null = null;
      try {
        if (db) {
          const snap = await getDoc(doc(db, 'siteContent', 'homePromotion'));
          if (snap.exists()) {
            const data = snap.data() as ActivePromo;
            const expired = data.expiresAt ? data.expiresAt < Date.now() : false;
            if (!expired) activePromo = data;
          }
        }
      } catch {
        // offline/sem permissão — segue sem promo no hero
      }
      if (cancelled || shelfResolved.current) return;

      const flagged = products.filter((p) => !p.hidden && p.heroCarousel);
      if (flagged.length === 0 && !activePromo) return; // nada marcado: mantém fallback

      const chosen = [...flagged]
        .sort(() => Math.random() - 0.5)
        .slice(0, HERO_MAX_PRODUCTS);
      const built: ShelfProduct[] = [
        ...(activePromo ? [promoToShelf(activePromo)] : []),
        ...chosen.map((p) => productToShelf(p, language)),
      ];
      shelfResolved.current = true;
      if (!cancelled) setShelf(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [products, productsLoading, language]);

  const totalPanels = shelf.length + 2; // intro + produtos + encerramento
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
  // Precisa nascer correto já no PRIMEIRO render. Antes começava `false`, e o
  // `useGSAP` abaixo (que roda uma vez só) via `simplified === false` no celular
  // e montava a prateleira horizontal: pin de ~2000px de altura e translateX na
  // track. O `useEffect` corrigia o estado logo depois, o JSX virava coluna
  // vertical — mas o pin e o transform já criados continuavam lá, presos a uma
  // track que não existia mais. Dava exatamente o relato do iPhone: a tela anda
  // para o lado, desce sozinha, e o miolo fica em branco até voltar ao topo.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);
  // Mobile usa layout vertical simples (sem pin GSAP) para reduzir rolagem.
  const simplified = reduced || isMobile;

  useGSAP(
    () => {
      if (simplified) return;
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
                totalPanels,
                Math.floor(self.progress * totalPanels) + 1,
              );
              counterRef.current.textContent = `${String(idx).padStart(2, '0')} / ${String(totalPanels).padStart(2, '0')}`;
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
        st ? Math.max(0, st.start + ((st.end - st.start) * i) / (totalPanels - 1)) : 0;

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
        const current = Math.round(st.progress * (totalPanels - 1));
        const next = Math.min(current + 1, totalPanels - 1);
        if (next === current) return; // chegou ao fim, autoplay encerra
        const done = () => {
          if (next < totalPanels - 1) schedule(PANEL_DWELL_MS);
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
    // `simplified` nas dependências + `revertOnUpdate`: girar o aparelho pode
    // cruzar o breakpoint de 768px (iPad/iPhone grande em landscape). Sem isto
    // o pin e o translateX da versão desktop sobreviveriam à virada para o
    // layout vertical — o mesmo estado quebrado, só que por outro caminho.
    { scope: sectionRef, dependencies: [simplified, totalPanels], revertOnUpdate: true },
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
        simplified ? 'min-h-[53dvh] md:min-h-screen' : 'h-full',
      )}
    >
      {/* Sem `loop`: ao terminar, a imagem final fica em cena e o recomeço
          acontece após a pausa configurada para esta versão.

          `preload="metadata"` e não `auto`: este vídeo tem ~2 MB e o `auto`
          manda o navegador baixá-lo INTEIRO na abertura da home, disputando
          banda com o JS, as fontes e o Firestore. No 4G do celular é isso que
          faz a página parecer travada. O `poster` pinta na hora e o vídeo entra
          em streaming progressivo — o autoplay continua funcionando igual. */}
      <video
        ref={introVideoRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src={introVideo.src}
        poster={introVideo.poster}
        autoPlay
        muted
        playsInline
        preload="metadata"
        onTimeUpdate={handleIntroTimeUpdate}
        onEnded={handleIntroEnded}
        aria-hidden
      />
      {/* O painel de vídeo não tem fundo próprio (só o `<video>` cobrindo
          `inset-0`) — a borda direita dele encosta direto no painel de produto
          seguinte, que é claro/rosa. Como o carrossel é scrub contínuo (sem
          scroll-snap), qualquer posição de rolagem entre painéis mostra os
          dois ao mesmo tempo, e sem transição essa borda vira um corte duro
          escuro→rosa que parece uma linha cortando a foto. Este degradê
          suaviza só a borda de saída, sem mexer no vídeo nem no painel seguinte.
          Some sozinho quando o vídeo chega na cena final rosa (os dois lados
          já ficam parecidos). */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[18%] bg-gradient-to-r from-transparent to-pink-50"
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
          {t('cinematicHero.intro.eyebrow')}
        </p>
        <h1 className="cinematic-reveal mb-3 font-display text-3xl font-light leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] sm:text-4xl md:mb-6 md:text-7xl">
          {t('cinematicHero.intro.title.1')}{language === 'ja' ? '' : ' '}
          <span className="font-jp italic text-pink-300">{t('cinematicHero.intro.title.highlight')}</span>
          <br />
          {t('cinematicHero.intro.title.2')}
        </h1>
        <p className="cinematic-reveal mb-4 max-w-sm text-xs leading-relaxed text-white/80 drop-shadow line-clamp-3 md:mb-10 md:max-w-md md:text-lg md:line-clamp-none">
          {t('cinematicHero.intro.description')}
        </p>
        <div className="cinematic-reveal flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/70 md:text-xs md:tracking-[0.3em]">
          <ArrowDown className="cinematic-bob h-3 w-3" />
          <span>{t('cinematicHero.intro.scroll')}</span>
        </div>
      </div>
    </div>
  );

  const renderProductPanel = (p: ShelfProduct, i: number) => {
    const name = p.name ?? (p.nameKey ? t(p.nameKey) : '');
    const description = p.description ?? (p.descriptionKey ? t(p.descriptionKey) : '');
    const promoDays = p.isPromo ? daysRemaining(p.expiresAt) : null;
    return (
    <div
      key={p.id}
      className={cn(
        'cinematic-panel relative flex w-screen shrink-0 items-center overflow-hidden',
        simplified ? 'min-h-[53dvh] md:min-h-screen' : 'h-full',
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
            alt={`${p.brand} ${name}`}
            loading="lazy"
            className="cinematic-product-img h-[18vh] max-h-[165px] w-auto object-contain md:h-[58vh] md:max-h-[440px]"
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
          {promoDays !== null && (
            <div
              className="cinematic-reveal mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold md:mb-3 md:text-xs"
              style={{ backgroundColor: `${p.accent}18`, color: p.accent }}
            >
              <Clock className="h-3 w-3" />
              {promoCountdownLabel(promoDays, language)}
            </div>
          )}
          <h2 className="cinematic-reveal mb-1 font-display text-2xl font-light leading-tight text-pink-950 md:mb-3 md:text-5xl">
            {name}
          </h2>
          {language !== 'ja' && p.nameJa && (
            <p className="cinematic-reveal font-jp mb-2 text-sm text-pink-700/70 md:mb-5 md:text-lg">
              {p.nameJa}
            </p>
          )}
          <p className="cinematic-reveal mb-3 text-xs leading-relaxed text-pink-950/60 line-clamp-2 md:mb-7 md:text-base md:line-clamp-3">
            {description}
          </p>
          <div className="cinematic-reveal flex items-center gap-4 md:gap-6">
            <span className="flex items-baseline gap-2">
              <span
                className="font-display text-xl md:text-2xl"
                style={{ color: p.isPromo ? p.accent : undefined }}
              >
                {formatPrice(convertYen(p.priceYen, currency), currency)}
              </span>
              {p.isPromo && p.originalPriceYen ? (
                <span className="text-sm text-pink-950/40 line-through">
                  {formatPrice(convertYen(p.originalPriceYen, currency), currency)}
                </span>
              ) : null}
            </span>
            <Link
              to={p.link}
              className="group inline-flex items-center gap-2 text-xs font-medium text-pink-700 transition-colors hover:text-pink-900 md:text-sm"
            >
              {t('featured.details')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderOutro = () => (
    <div
      key="outro"
      className={cn(
        'cinematic-panel relative flex w-screen shrink-0 items-center justify-center overflow-hidden px-4 md:px-6',
        simplified ? 'min-h-[53dvh] md:min-h-screen' : 'h-full',
      )}
    >
      <div className="cinematic-kanji font-jp pointer-events-none absolute bottom-[6%] left-[8%] select-none text-[42vmin] leading-none">
        蜜
      </div>
      <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
        <ShoppingBag className="cinematic-reveal mb-3 h-7 w-7 text-pink-600 md:mb-6 md:h-10 md:w-10" />
        <h2 className="cinematic-reveal mb-3 font-display text-3xl font-light leading-tight text-pink-950 md:mb-5 md:text-6xl">
          {t('cinematicHero.outro.title.1')}
          <br />
          {t('cinematicHero.outro.title.2')}
        </h2>
        <p className="cinematic-reveal mb-4 max-w-xs text-sm text-pink-950/60 md:mb-9 md:max-w-sm md:text-base">
          {t('cinematicHero.outro.description')}
        </p>
        <div className="cinematic-reveal flex flex-col gap-3 sm:flex-row">
          <Link
            to="/produtos/cosmeticos"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-6 py-2.5 text-xs font-medium text-white transition-colors hover:bg-pink-700 md:px-8 md:py-3 md:text-sm"
          >
            {t('cinematicHero.outro.cta.products')} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/faca-seu-pedido"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-pink-300 px-6 py-2.5 text-xs font-medium text-pink-700 transition-colors hover:bg-pink-50 md:px-8 md:py-3 md:text-sm"
          >
            {t('cinematicHero.outro.cta.order')}
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
        // No smartphone, ocupa 53% da tela. Desktop preserva a experiência
        // cinematográfica em viewport completo.
        simplified
          ? ''
          : 'h-[53dvh] min-h-[390px] max-h-[480px] md:h-[calc(100dvh-var(--shelf-top,0px))] md:min-h-0 md:max-h-none',
      )}
      aria-label={t('cinematicHero.ariaLabel')}
    >
      {/* Superfície da prateleira — persiste enquanto os produtos deslizam.
          Na versão 'transition' ela nasce OCULTA: antes do vídeo chegar no
          momento-logo (~5,6s) o painel em cena ainda é o travelling puro, sem
          prateleira nenhuma — a linha cortando o vídeo aí parecia um risco de
          renderização. Ela entra junto com a cena rosa final, quando a
          metáfora de "prateleira" passa a fazer sentido. */}
      {!simplified && (
        <>
          <div className="cinematic-shelf-glow" aria-hidden />
          <div
            className={cn(
              'cinematic-shelf-line transition-opacity duration-1000',
              introVariant === 'transition' && (logoMoment ? 'opacity-100' : 'opacity-0'),
            )}
            aria-hidden
          />
        </>
      )}

      {/* Barra superior */}
      {!simplified && (
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-end px-4 py-3 md:px-12 md:py-5">
          <div className="flex items-center gap-4 md:gap-6">
            <span
              ref={counterRef}
              className="font-jp text-[10px] tracking-[0.3em] text-white/80 mix-blend-difference md:text-xs md:tracking-[0.35em]"
            >
              {`01 / ${String(totalPanels).padStart(2, '0')}`}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-[10px] uppercase tracking-[0.2em] text-white/70 mix-blend-difference transition-opacity hover:opacity-100 md:text-xs md:tracking-[0.25em]"
            >
              {t('cinematicHero.skip')}
            </button>
          </div>
        </div>
      )}

      {/* Track horizontal (pin & scrub via GSAP) */}
      <div
        ref={trackRef}
        className={cn('will-change-transform', simplified ? 'flex flex-col' : 'flex h-full')}
      >
        {renderIntro()}
        {shelf.map(renderProductPanel)}
        {renderOutro()}
      </div>

      {/* Barra de progresso + dica inferior */}
      {!simplified && (
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
            <span>{t('cinematicHero.scrollHint')}</span>
          </div>
        </>
      )}
    </section>
  );
};

export default CinematicHeroShelf;
