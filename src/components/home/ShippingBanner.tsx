import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import NewsletterSection from '@/components/home/NewsletterSection';

const FEATURE_KEYS = [
  { titleKey: 'shippingBanner.carrier1.title', descKey: 'shippingBanner.carrier1.desc' },
  { titleKey: 'shippingBanner.carrier2.title', descKey: 'shippingBanner.carrier2.desc' },
  { titleKey: 'shippingBanner.carrier3.title', descKey: 'shippingBanner.carrier3.desc' },
  { titleKey: 'shippingBanner.carrier4.title', descKey: 'shippingBanner.carrier4.desc' },
] as const;

/**
 * Frete + newsletter numa seção só: a newsletter sozinha tinha ~380px (menos de
 * meia tela) e virava uma faixa vazia. Aqui ela fecha o bloco, sem título nem
 * fundo próprios.
 */
const ShippingBanner: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="bg-white py-16 text-foreground md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="mb-3 font-display text-2xl font-bold md:text-4xl">{t('shipping.title')}</h2>
          <p className="text-sm text-muted-foreground md:text-lg">{t('shipping.subtitle')}</p>
        </div>

        <dl className="mb-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-pink-100 pt-8 lg:grid-cols-4">
          {FEATURE_KEYS.map((feature) => (
            <div key={feature.titleKey} className="border-l-2 border-primary pl-4">
              <dt className="font-display text-sm font-semibold md:text-lg">{t(feature.titleKey)}</dt>
              <dd className="mt-1 text-xs text-muted-foreground md:text-sm">{t(feature.descKey)}</dd>
            </div>
          ))}
        </dl>

        <div className="mb-14 text-center">
          <Button asChild size="lg" className="rounded-full px-8 text-base font-semibold">
            <Link to="/frete">{t('shippingBanner.cta')}</Link>
          </Button>
        </div>

        <NewsletterSection embedded />
      </div>
    </section>
  );
};

export default ShippingBanner;
