import React, { useEffect, useRef, useState } from 'react';
import '@google/model-viewer';
import { Hand, ScanLine } from 'lucide-react';
import type { Product3DModel } from '@/types';

type ModelViewerProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  src: string;
  'ios-src'?: string;
  poster?: string;
  alt?: string;
  ar?: string;
  'ar-modes'?: string;
  'ar-scale'?: string;
  'camera-controls'?: string;
  'auto-rotate'?: string;
  'auto-rotate-delay'?: string;
  'rotation-per-second'?: string;
  'interaction-prompt'?: string;
  'shadow-intensity'?: string;
  'shadow-softness'?: string;
  'environment-image'?: string;
  exposure?: string;
  'touch-action'?: string;
  'camera-orbit'?: string;
  loading?: 'auto' | 'lazy' | 'eager';
};

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerProps;
    }
  }
}

interface Product3DViewerProps {
  model: Product3DModel;
  alt: string;
}

/**
 * Produto em 3D: girar com o dedo/mouse, zoom com pinça/roda e botão
 * "Ver no seu espaço" (AR) — Scene Viewer no Android, Quick Look no iPhone,
 * WebXR quando disponível. Carregado sob demanda pela galeria.
 */
const Product3DViewer: React.FC<Product3DViewerProps> = ({ model, alt }) => {
  const ref = useRef<HTMLElement>(null);
  const [canAR, setCanAR] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current as (HTMLElement & { canActivateAR?: boolean }) | null;
    if (!el) return;
    const onLoad = () => setCanAR(Boolean(el.canActivateAR));
    const onError = () => setFailed(true);
    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
    };
  }, [model.src]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar o modelo 3D. Veja as fotos ao lado.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-white to-pink-50">
      <model-viewer
        ref={ref}
        src={model.src}
        ios-src={model.iosSrc}
        poster={model.poster}
        alt={alt}
        ar=""
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="auto"
        camera-controls=""
        auto-rotate=""
        auto-rotate-delay="1500"
        rotation-per-second="20deg"
        interaction-prompt="auto"
        touch-action="pan-y"
        shadow-intensity="1"
        shadow-softness="0.8"
        environment-image="neutral"
        exposure="1.05"
        loading="eager"
        style={{ width: '100%', height: '100%', background: 'transparent', '--poster-color': 'transparent' } as React.CSSProperties}
      >
        {/* Botão de AR próprio (o padrão do model-viewer é um ícone pequeno). */}
        <button
          slot="ar-button"
          type="button"
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-600/30 active:scale-95"
        >
          <ScanLine className="h-4 w-4" />
          Ver no seu espaço
        </button>
      </model-viewer>
      {!canAR && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white">
          <Hand className="h-3.5 w-3.5" />
          Arraste para girar · role para aproximar
        </div>
      )}
    </div>
  );
};

export default Product3DViewer;
