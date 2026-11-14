import React from 'react';
import { Link } from 'react-router-dom';
import { Gift, Sparkles, X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
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
  const { t } = useLanguage();
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
    <div className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-pink-500 to-fuchsia-600 text-white">
      <div className="container mx-auto px-4 py-2 pr-12 sm:pr-4 flex items-center justify-center gap-2 sm:gap-3 text-center">
        <Gift className="w-5 h-5 shrink-0 hidden sm:block" />
        <p className="text-xs sm:text-base font-semibold leading-tight">
          {context === 'cart' ? t('welcomeBanner.cart') : ''}
          <Sparkles className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5" /> {t('welcomeBanner.text')}{' '}
          <strong className="font-black">{t('welcomeBanner.discount')}</strong>
          <span className="hidden sm:inline">
            {' '}— {t('welcomeBanner.codeLabel')}{' '}
            <span className="inline-block bg-white/25 px-2 py-0.5 rounded-md font-black tracking-wider">
              {t('welcomeBanner.code')}
            </span>
          </span>{' '}
          <Link to="/cadastro" className="inline-block py-3.5 -my-3.5 underline underline-offset-2 font-bold hover:text-yellow-100 whitespace-nowrap">
            {t('welcomeBanner.cta')} →
          </Link>
        </p>
        <button
          onClick={dismiss}
          aria-label={t('welcomeBanner.close')}
          className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeCouponBanner;
