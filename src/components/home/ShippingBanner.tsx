import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, MapPin, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const ShippingBanner: React.FC = () => {
  const { t } = useLanguage();

  const features = [
    { icon: Truck, titleKey: 'shippingBanner.carrier1.title', descKey: 'shippingBanner.carrier1.desc' },
    { icon: MapPin, titleKey: 'shippingBanner.carrier2.title', descKey: 'shippingBanner.carrier2.desc' },
    { icon: Package, titleKey: 'shippingBanner.carrier3.title', descKey: 'shippingBanner.carrier3.desc' },
    { icon: Clock, titleKey: 'shippingBanner.carrier4.title', descKey: 'shippingBanner.carrier4.desc' },
  ];

  return (
    <section className="py-16 md:py-20 bg-white text-foreground">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6 md:mb-12">
          <h2 className="font-display text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4">
            {t('shipping.title')}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-lg">
            {t('shipping.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-12">
          {features.map((feature) => (
            <div
              key={feature.titleKey}
              className="rounded-2xl border border-pink-100 bg-pink-50/60 p-3 md:p-6 text-center"
            >
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white text-primary ring-1 ring-pink-200 flex items-center justify-center mx-auto mb-2 md:mb-4">
                <feature.icon className="w-5 h-5 md:w-7 md:h-7" aria-hidden="true" />
              </div>
              <h3 className="font-display text-sm md:text-lg font-semibold mb-1">
                {t(feature.titleKey)}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="rounded-full px-8 text-base font-semibold">
            <Link to="/frete">
              {t('shippingBanner.cta')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ShippingBanner;
