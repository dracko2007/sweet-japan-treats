import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/utils';

/** Envolve uma seção e aplica fade-up suave quando ela entra na viewport. */
const ScrollReveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        className
      )}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
