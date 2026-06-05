import React from 'react';
import { Heart, Star, Users, Award, MessageCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';
import JapanExpressLogo from '@/components/JapanExpressLogo';

const About: React.FC = () => {
  const { t, selectedCountry } = useLanguage();
  const isJapan = selectedCountry === 'Japão';

  const values = [
    { icon: Heart, titleKey: 'aboutPage.value1.title', descKey: 'aboutPage.value1.desc' },
    { icon: Star, titleKey: 'aboutPage.value2.title', descKey: 'aboutPage.value2.desc' },
    { icon: Users, titleKey: 'aboutPage.value3.title', descKey: 'aboutPage.value3.desc' },
    { icon: Award, titleKey: 'aboutPage.value4.title', descKey: 'aboutPage.value4.desc' },
  ];

  const timeline = [
    { year: '2018', titleKey: 'aboutPage.timeline.2018.title', descKey: 'aboutPage.timeline.2018.desc' },
    { year: '2019', titleKey: 'aboutPage.timeline.2019.title', descKey: 'aboutPage.timeline.2019.desc' },
    { year: '2020', titleKey: 'aboutPage.timeline.2020.title', descKey: 'aboutPage.timeline.2020.desc' },
    { year: '2021', titleKey: 'aboutPage.timeline.2021.title', descKey: 'aboutPage.timeline.2021.desc' },
    { year: '2023', titleKey: 'aboutPage.timeline.2023.title', descKey: 'aboutPage.timeline.2023.desc' },
    { year: '2024', titleKey: 'aboutPage.timeline.2024.title', descKey: 'aboutPage.timeline.2024.desc' },
  ];

  return (
    <Layout>
      {/* Hero */}
      <div className="gradient-hero py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                {t('aboutPage.badge')}
              </span>
              <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-6">
                {t('aboutPage.title')}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t('aboutPage.description')}
              </p>
            </div>
            
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-caramel-light/40 to-primary/30 flex items-center justify-center shadow-elevated">
                <div className="text-center">
                  <JapanExpressLogo size={140} className="mx-auto mb-4 shadow-elevated" />
                  <p className="font-display text-xl text-foreground">{t('aboutPage.family')}</p>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-card rounded-2xl shadow-card p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">✈️</span>
                  <div>
                    <p className="font-display font-semibold text-sm">{t('aboutPage.location')}</p>
                    <p className="text-xs text-muted-foreground">{t('aboutPage.kitchen')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {t('aboutPage.valuesTitle')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('aboutPage.valuesSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.titleKey} className="p-6 rounded-2xl bg-background border border-border text-center">
                <div className="w-14 h-14 rounded-full gradient-caramel flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {t(value.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(value.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {t('aboutPage.journeyTitle')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('aboutPage.journeySubtitle')}
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {timeline.map((item, index) => (
              <div key={item.year} className="relative pl-8 pb-8 last:pb-0">
                {index !== timeline.length - 1 && (
                  <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                )}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full gradient-caramel flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
                <div className="bg-card rounded-xl p-5 border border-border ml-4">
                  <span className="text-sm font-semibold text-primary">{item.year}</span>
                  <h3 className="font-display text-lg font-semibold text-foreground mt-1">
                    {t(item.titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-caramel text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-bold mb-4">
            {t('aboutPage.ctaTitle')}
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            {t('aboutPage.ctaDesc')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/produtos" 
              className="px-8 py-3 bg-background text-foreground rounded-full font-semibold hover:bg-background/90 transition-colors"
            >
              {t('aboutPage.ctaProducts')}
            </a>
            <a
              href="mailto:contato@japanexpress-store.com"
              className="px-8 py-3 border-2 border-primary-foreground rounded-full font-semibold hover:bg-primary-foreground/10 transition-colors"
            >
              {t('aboutPage.ctaContact')}
            </a>
            <a
              href="https://wa.me/817013671679"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-green-500 text-white rounded-full font-semibold hover:bg-green-600 transition-colors inline-flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
