import React from 'react';
import { Link } from 'react-router-dom';
import { Gift, Sparkles, X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { safeStorage } from '@/utils/storage';

const DISMISS_KEY = 'welcome_banner_dismissed_at';
const DISMISS_DAYS = 3;

/**
 * Banner de destaque do cupom de boas-vindas BEMVINDO10 (10% OFF).
 * "Grita" na home e no carrinho para usuários NÃO logados — transformando o
 * cadastro em um motivo claro de conversão. Dismissível por alguns dias para
 * não cansar quem já viu.
 */
const WelcomeCouponBanner: React.FC<{ context?: 'home' | 'cart' }> = ({ context = 'home' }) => {
  const { isAuthenticated } = useUser();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const raw = safeStorage.getItem(DISMISS_KEY);
    if (raw && Date.now() - Number(raw) < DISMISS_DAYS * 86400000) {
      setDismissed(true);
    }
  }, []);

  if (isAuthenticated || dismissed) return null;

  const dismiss = () => {
    safeStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-pink-500 to-amber-500 text-white">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-center">
        <Gift className="w-5 h-5 shrink-0 hidden sm:block" />
        <p className="text-sm sm:text-base font-semibold leading-tight">
          {context === 'cart' ? 'Ainda não tem cadastro? ' : ''}
          <Sparkles className="inline w-4 h-4 mb-0.5" /> Cadastre-se e ganhe{' '}
          <strong className="font-black">10% OFF</strong> — cupom{' '}
          <span className="inline-block bg-white/25 backdrop-blur px-2 py-0.5 rounded-md font-black tracking-wider">
            BEMVINDO10
          </span>{' '}
          <Link to="/cadastro" className="underline underline-offset-2 font-bold hover:text-yellow-100 whitespace-nowrap">
            Criar conta grátis →
          </Link>
        </p>
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeCouponBanner;
