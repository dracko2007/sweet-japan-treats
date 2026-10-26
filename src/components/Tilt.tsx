import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTilt } from '@/hooks/useTilt';

interface TiltProps {
  children: React.ReactNode;
  className?: string;
  /** Inclinação máxima em graus. */
  max?: number;
  lift?: number;
  /** Brilho de vidro que segue o mouse. */
  glare?: boolean;
  /** Arredondamento do brilho (deve casar com o filho). */
  glareClassName?: string;
}

/**
 * Envolve qualquer bloco com a inclinação 3D que segue o mouse.
 * No toque / com `prefers-reduced-motion`, vira uma div comum.
 */
const Tilt: React.FC<TiltProps> = ({ children, className, max = 10, lift = 1.03, glare = true, glareClassName }) => {
  const tilt = useTilt({ max, lift, parallax: 0 });
  return (
    <motion.div className={cn('relative', className)} style={tilt.cardStyle} {...tilt.handlers}>
      {children}
      {glare && (
        <motion.div
          className={cn('pointer-events-none absolute inset-0 z-10 mix-blend-soft-light', glareClassName)}
          style={tilt.glareStyle}
          aria-hidden
        />
      )}
    </motion.div>
  );
};

export default Tilt;
