import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { Box, ChevronLeft, ChevronRight, Play, X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinePointer } from '@/hooks/useTilt';
import type { Product3DModel } from '@/types';

// O visualizador 3D (three.js) é pesado — só baixa quando o cliente abre a aba 3D.
const Product3DViewer = lazy(() => import('./Product3DViewer'));

interface ProductGalleryProps {
  images: string[];
  productName: string;
  video?: string;
  videoCover?: boolean;
  model3d?: Product3DModel;
}

type FlatMedia = { kind: 'image' | 'video'; src: string };
type Media = FlatMedia | { kind: 'model'; model: Product3DModel };

const SWIPE_PX = 50;
const SWIPE_VELOCITY = 400;
const MODAL_ZOOM = 2.5;

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '30%' : '-30%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-30%' : '30%', opacity: 0 }),
};

const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, video, videoCover, model3d }) => {
  const [[selectedIndex, direction], setSelected] = useState<[number, number]>([0, 0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const fine = useFinePointer();

  // Vídeo: capa → primeiro; senão → fim. Modelo 3D entra logo depois da capa.
  const imageMedia: FlatMedia[] = images.map((src) => ({ kind: 'image', src }));
  const videoMedia: FlatMedia[] = video ? [{ kind: 'video', src: video }] : [];
  const base: FlatMedia[] = videoCover ? [...videoMedia, ...imageMedia] : [...imageMedia, ...videoMedia];
  const allMedia: Media[] = model3d ? [...base.slice(0, 1), { kind: 'model', model: model3d }, ...base.slice(1)] : base;
  const count = allMedia.length;
  const current: Media | undefined = allMedia[Math.min(selectedIndex, count - 1)];

  const goTo = (index: number) => setSelected(([prev]) => [index, index > prev ? 1 : -1]);
  const handleNext = () => setSelected(([i]) => [(i + 1) % count, 1]);
  const handlePrevious = () => setSelected(([i]) => [(i - 1 + count) % count, -1]);

  if (!current) return null;
  const isModel = current.kind === 'model';

  // Lupa (computador): amplia 2x seguindo o mouse.
  const onLensMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!fine || current.kind !== 'image' || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const onSwipe = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) handleNext();
    else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) handlePrevious();
  };

  const renderMedia = (m: Media) => {
    if (m.kind === 'video') {
      return <video src={m.src} autoPlay loop muted playsInline className="h-full w-full object-contain" />;
    }
    if (m.kind === 'model') {
      return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Carregando 3D…</div>}>
          <Product3DViewer model={m.model} alt={productName} />
        </Suspense>
      );
    }
    return (
      <img
        src={m.src}
        alt={productName}
        draggable={false}
        className="h-full w-full object-contain transition-transform duration-200 ease-out"
        style={lens ? { transform: 'scale(2)', transformOrigin: `${lens.x}% ${lens.y}%` } : undefined}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Principal: arrasta para os lados no celular, lupa no computador. */}
      <div
        className={cn(
          'relative aspect-square overflow-hidden rounded-xl bg-secondary',
          !isModel && (fine ? 'cursor-zoom-in' : 'cursor-pointer'),
        )}
        onPointerMove={onLensMove}
        onPointerLeave={() => setLens(null)}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={selectedIndex}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="absolute inset-0 touch-pan-y"
            // Arrastar só no toque (no 3D o dedo gira o modelo, não troca a foto).
            drag={!fine && count > 1 && !isModel ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={onSwipe}
            // onTap não dispara depois de um arraste — o swipe não abre o modal.
            onTap={() => { if (!isModel) setIsModalOpen(true); }}
          >
            {renderMedia(current)}
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow transition-colors hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow transition-colors hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Bolinhas (celular) + contador (computador) */}
        {count > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 md:hidden">
            {allMedia.map((_, i) => (
              <span
                key={i}
                className={cn('h-1.5 rounded-full bg-white shadow transition-all', i === selectedIndex ? 'w-5 opacity-100' : 'w-1.5 opacity-60')}
              />
            ))}
          </div>
        )}
        {count > 1 && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden rounded-full bg-black/60 px-3 py-1 text-sm text-white md:block">
            {selectedIndex + 1} / {count}
          </div>
        )}
        {current.kind === 'image' && !lens && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white">
            <ZoomIn className="h-3.5 w-3.5" />
            {fine ? 'Passe o mouse para ampliar' : 'Toque para ampliar'}
          </div>
        )}
      </div>

      {/* Miniaturas */}
      {count > 1 && (
        <div className="grid grid-cols-5 gap-2 md:grid-cols-6">
          {allMedia.map((m, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={m.kind === 'model' ? 'Ver em 3D' : `${productName} ${index + 1}`}
              aria-current={selectedIndex === index}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
                selectedIndex === index ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border',
              )}
            >
              {m.kind === 'model' ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white">
                  <Box className="h-5 w-5" />
                  <span className="text-[10px] font-black">3D</span>
                </span>
              ) : m.kind === 'video' ? (
                <>
                  <video src={m.src} muted preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </span>
                </>
              ) : (
                <img src={m.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {isModalOpen && current.kind !== 'model' && (
        <GalleryModal
          media={base}
          startSrc={current.src}
          productName={productName}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

interface GalleryModalProps {
  media: FlatMedia[];
  startSrc: string;
  productName: string;
  onClose: () => void;
}

/** Tela cheia: setas/teclado, arraste para trocar, toque duplo (ou clique) para zoom e arraste para mover. */
const GalleryModal: React.FC<GalleryModalProps> = ({ media, startSrc, productName, onClose }) => {
  const [index, setIndex] = useState(() => Math.max(0, media.findIndex((m) => m.src === startSrc)));
  const [zoomed, setZoomed] = useState(false);
  const lastTap = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const count = media.length;
  const m = media[index];

  const next = useCallback(() => { setZoomed(false); setIndex((i) => (i + 1) % count); }, [count]);
  const prev = useCallback(() => { setZoomed(false); setIndex((i) => (i - 1 + count) % count); }, [count]);

  useEffect(() => {
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus();
    };
  }, [next, prev, onClose]);

  const onImageTap = () => {
    const now = Date.now();
    // Computador: um clique alterna o zoom. Toque: precisa de toque duplo
    // (o toque simples fica para arrastar/trocar).
    if (fine || now - lastTap.current < 300) {
      setZoomed((z) => !z);
    }
    lastTap.current = now;
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={productName}
      tabIndex={-1}
      data-lenis-prevent
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 outline-none"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        aria-label="Fechar"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      <div className="relative flex h-full max-h-[90vh] w-full max-w-6xl items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {m.kind === 'video' ? (
          <video src={m.src} autoPlay loop muted playsInline className="max-h-full max-w-full object-contain" />
        ) : (
          <motion.img
            key={m.src}
            src={m.src}
            alt={productName}
            draggable={false}
            className={cn('max-h-full max-w-full touch-none select-none object-contain', zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={zoomed ? { opacity: 1, scale: MODAL_ZOOM } : { opacity: 1, scale: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            // Com zoom: arrasta livre para ver detalhes. Sem zoom: arrasta para os lados para trocar.
            drag={zoomed ? true : count > 1 ? 'x' : false}
            dragConstraints={zoomed ? { left: -400, right: 400, top: -400, bottom: 400 } : { left: 0, right: 0 }}
            dragElastic={zoomed ? 0.15 : 0.6}
            onDragEnd={(_, info) => {
              if (zoomed) return;
              if (info.offset.x < -SWIPE_PX) next();
              else if (info.offset.x > SWIPE_PX) prev();
            }}
            onTap={onImageTap}
          />
        )}

        {count > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </>
        )}

        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
          {m.kind === 'video'
            ? `${index + 1} / ${count}`
            : zoomed
              ? `Arraste para mover · ${fine ? 'clique' : 'toque duplo'} para sair`
              : `${index + 1} / ${count} · ${fine ? 'clique' : 'toque duplo'} para zoom`}
        </div>
      </div>
    </div>
  );
};

export default ProductGallery;
