import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, Clock, Shield, ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const Shipping: React.FC = () => {
  const { t } = useLanguage();

  const carriers = [
    {
      name: t('shippingPage.carrier1.name'),
      logo: '📮',
      description: t('shippingPage.carrier1.desc'),
      features: [t('shippingPage.carrier1.f1'), t('shippingPage.carrier1.f2'), t('shippingPage.carrier1.f3')]
    },
    {
      name: t('shippingPage.carrier2.name'),
      logo: '🐱',
      description: t('shippingPage.carrier2.desc'),
      features: [t('shippingPage.carrier2.f1'), t('shippingPage.carrier2.f2'), t('shippingPage.carrier2.f3')]
    },
    {
      name: t('shippingPage.carrier3.name'),
      logo: '📦',
      description: t('shippingPage.carrier3.desc'),
      features: [t('shippingPage.carrier3.f1'), t('shippingPage.carrier3.f2'), t('shippingPage.carrier3.f3')]
    }
  ];

  const faqItems = [
    { question: t('shippingPage.faq1.q'), answer: t('shippingPage.faq1.a') },
    { question: t('shippingPage.faq2.q'), answer: t('shippingPage.faq2.a') },
    { question: t('shippingPage.faq3.q'), answer: t('shippingPage.faq3.a') },
    { question: t('shippingPage.faq4.q'), answer: t('shippingPage.faq4.a') },
  ];

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {t('shippingPage.title')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('shippingPage.description')}
            </p>
          </div>
        </div>
      </div>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <ShippingCalculator />
              
              <div className="mt-6 p-4 bg-secondary/50 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  <strong>💡 {t('shippingPage.tip').split('.')[0]}.</strong> {t('shippingPage.tip').includes('.') ? t('shippingPage.tip').split('.').slice(1).join('.') : ''}
                </p>
                <Button asChild variant="link" className="mt-2 p-0 h-auto text-primary">
                  <Link to="/produtos">
                    {t('shippingPage.viewProducts')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                  {t('shippingPage.carriersTitle')}
                </h2>
                <div className="space-y-4">
                  {carriers.map((carrier) => (
                    <div key={carrier.name} className="p-4 rounded-xl bg-card border border-border">
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{carrier.logo}</span>
                        <div>
                          <h3 className="font-semibold text-foreground">{carrier.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{carrier.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {carrier.features.map((feature) => (
                              <span key={feature} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  {t('shippingPage.boxTitle')}
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="font-medium text-foreground min-w-[60px]">60cm:</span>
                    <span className="text-muted-foreground">{t('shippingPage.box60')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-medium text-foreground min-w-[60px]">80cm:</span>
                    <span className="text-muted-foreground">{t('shippingPage.box80')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t border-primary/10">
                    {t('shippingPage.boxNote')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="font-display text-2xl font-bold text-foreground mb-8 text-center">
              {t('shippingPage.faqTitle')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {faqItems.map((item) => (
                <div key={item.question} className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Shipping;
