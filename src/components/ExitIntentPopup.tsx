import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { newsletterService } from '@/services/newsletterService';
import { safeStorage } from '@/utils/storage';

const SHOWN_KEY = 'exit_intent_shown_at';
const COOLDOWN_DAYS = 14;
const MIN_TIME_ON_PAGE_MS = 6000;

/**
 * Captura de e-mail de visitantes que vão embora sem comprar (exit-intent).
 * Isca: "Guia: como importar do Japão sem pagar taxa". Dispara ao detectar a
 * intenção de saída (mouse sai pelo topo no desktop / tempo + scroll no mobile).
 * Não aparece para usuários logados nem repete por 14 dias.
 */
const ExitIntentPopup: React.FC = () => {
  const { isAuthenticated } = useUser();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setEligible(false);
      return;
    }
    const last = Number(safeStorage.getItem(SHOWN_KEY) || 0);
    setEligible(Date.now() - last > COOLDOWN_DAYS * 86400000);
  }, [isAuthenticated]);

  const trigger = useCallback(() => {
    setOpen((prev) => {
      if (prev) return prev;
      safeStorage.setItem(SHOWN_KEY, String(Date.now()));
      return true;
    });
  }, []);

  useEffect(() => {
    if (!eligible) return;
    const start = Date.now();

    const onMouseOut = (e: MouseEvent) => {
      if (Date.now() - start < MIN_TIME_ON_PAGE_MS) return;
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };

    const isTouch = window.matchMedia('(hover: none)').matches;
    let mobileTimer: ReturnType<typeof setTimeout> | null = null;
    let scrolled = false;
    const onScroll = () => {
      scrolled = true;
    };

    if (isTouch) {
      window.addEventListener('scroll', onScroll, { passive: true });
      mobileTimer = setTimeout(() => {
        if (scrolled) trigger();
      }, 35000);
    } else {
      document.addEventListener('mouseout', onMouseOut);
    }

    return () => {
      document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('scroll', onScroll);
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, [eligible, trigger]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast({ title: 'E-mail inválido', description: 'Digite um e-mail válido para receber o guia.' });
      return;
    }
    setStatus('loading');
    await newsletterService.capture({ email: value, source: 'exit_intent' });
    setStatus('done');
    setTimeout(() => setOpen(false), 2500);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Guia gratuito de importação"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-gradient-to-br from-pink-600 to-amber-500 p-6 text-center text-white">
          <Download className="w-10 h-10 mx-auto mb-2" />
          <h2 className="text-xl font-black leading-tight">
            Guia Grátis: Importar do Japão sem pagar taxa
          </h2>
          <p className="text-sm text-white/90 mt-1">
            O passo a passo para receber seus produtos pagando menos imposto. Deixe seu e-mail e receba agora.
          </p>
        </div>

        {status === 'done' ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="font-bold text-gray-800 dark:text-gray-100">Tudo certo! 🎉</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Em breve você recebe o guia e ofertas exclusivas no seu e-mail.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Quero o guia grátis</>}
            </button>
            <p className="text-[11px] text-center text-gray-400">Sem spam. Cancele quando quiser.</p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ExitIntentPopup;
