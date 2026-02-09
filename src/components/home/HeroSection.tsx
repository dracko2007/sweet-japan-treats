import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const HeroSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[90vh] gradient-hero overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-caramel-light/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
          {/* Content */}
          <div className="space-y-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              {t('hero.badge')}
            </div>
            
            <h1 className="font-display text-5xl lg:text-7xl font-bold leading-tight text-foreground">
              {t('hero.title.1')}{' '}
              <span className="text-gradient">{t('hero.title.highlight')}</span>{' '}
              {t('hero.title.2')}
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              {t('hero.description')}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="btn-primary rounded-full px-8 text-base">
                <Link to="/produtos">
                  {t('hero.cta.products')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base border-2">
                <Link to="/sobre">
                  {t('hero.cta.story')}
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 pt-4">
              <div>
                <p className="font-display text-3xl font-bold text-foreground">100%</p>
                <p className="text-sm text-muted-foreground">{t('hero.stat.artesanal')}</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className="font-display text-3xl font-bold text-foreground">7+</p>
                <p className="text-sm text-muted-foreground">{t('hero.stat.flavors')}</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className="font-display text-3xl font-bold text-foreground">47</p>
                <p className="text-sm text-muted-foreground">{t('hero.stat.provinces')}</p>
              </div>
            </div>
          </div>

          {/* Video Section */}
          <div className="relative animate-fade-in">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-elevated bg-card">
              {/* Video */}
              <video 
                className="w-full h-full object-cover"
                controls
                poster="/video/preparo-thumbnail.jpg"
                preload="metadata"
              >
                <source src="/video/preparo.mp4" type="video/mp4" />
              </video>

              {/* Decorative border */}
              <div className="absolute inset-0 border-4 border-primary/20 rounded-3xl pointer-events-none" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-card rounded-2xl shadow-card p-4 animate-float">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">🇧🇷</span>
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">{t('hero.badge.recipe')}</p>
                  <p className="text-xs text-muted-foreground">{t('hero.badge.tradition')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
