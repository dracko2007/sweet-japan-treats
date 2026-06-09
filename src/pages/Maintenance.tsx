import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Lock } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';

const MaintenancePage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 via-pink-50 to-white flex items-center justify-center px-4">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <div className="text-center max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="w-12 h-12 text-primary" />
          </div>
        </div>

        <h1 className="font-display text-4xl font-bold text-foreground">{t('maintenance.title')}</h1>

        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('maintenance.description')} 🎨
        </p>

        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-sm text-muted-foreground">
            {t('maintenance.card')} ✨
          </p>
        </div>

        {/* Acesso administrativo — nunca trava o admin do lado de fora */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-primary transition-colors"
        >
          <Lock className="w-3 h-3" /> {t('maintenance.admin')}
        </Link>
      </div>
    </div>
  );
};

export default MaintenancePage;
