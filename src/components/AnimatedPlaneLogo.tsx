import React from 'react';
import { PlaneTakeoff } from 'lucide-react';

interface AnimatedPlaneLogoProps {
  size?: number;
  className?: string;
  imageClassName?: string;
  alt?: string;
}

/**
 * Logo usada dentro da experiência web/PWA. O ícone instalado no sistema
 * permanece estático por limitação das plataformas; aqui o avião ganha movimento
 * durante o carregamento e nas prévias do app.
 */
const AnimatedPlaneLogo: React.FC<AnimatedPlaneLogoProps> = ({
  size = 48,
  className = '',
  imageClassName = '',
  alt = 'Japan Express',
}) => (
  <div
    className={`relative inline-flex shrink-0 overflow-hidden rounded-full ${className}`}
    style={{ width: size, height: size }}
  >
    <img
      src="/logo.jpg"
      alt={alt}
      width={size}
      height={size}
      className={`h-full w-full object-cover ${imageClassName}`}
    />
    <PlaneTakeoff
      aria-hidden="true"
      strokeWidth={2.75}
      className="pwa-logo-plane pointer-events-none absolute left-[42%] top-[64%] h-[30%] w-[30%] text-white drop-shadow-[0_1px_2px_rgba(131,24,67,0.55)]"
    />
  </div>
);

export default AnimatedPlaneLogo;
