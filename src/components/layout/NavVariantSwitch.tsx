import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { setNavVariant, useNavVariant, type NavVariant } from './navVariant';

const OPTIONS: { value: NavVariant; label: string }[] = [
  { value: 'pro', label: 'Nova' },
  { value: 'original', label: 'Original' },
];

/** SANDBOX — compara a navegação nova com a original ao vivo. */
const NavVariantSwitch: React.FC = () => {
  const variant = useNavVariant();
  return (
    <div
      role="radiogroup"
      aria-label="Sandbox: versão da navegação"
      className="fixed left-1/2 top-2 z-[9990] flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-300 bg-amber-50/95 p-1 text-[11px] font-bold shadow-lg backdrop-blur print:hidden md:top-auto md:bottom-4"
    >
      <span className="px-2 text-amber-800">🧪 Sandbox</span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={variant === o.value}
          onClick={() => setNavVariant(o.value)}
          className={cn('relative rounded-full px-3 py-1 transition-colors', variant === o.value ? 'text-white' : 'text-amber-900 hover:bg-amber-100')}
        >
          {variant === o.value && (
            <motion.span layoutId="nav-variant-pill" className="absolute inset-0 rounded-full bg-amber-500" aria-hidden />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
};

export default NavVariantSwitch;
