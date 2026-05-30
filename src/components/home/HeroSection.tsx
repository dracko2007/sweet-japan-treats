import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, PlaneTakeoff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const HeroSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[85vh] bg-gradient-to-b from-orange-50 via-orange-50/50 to-white overflow-hidden pt-12">
      {/* Background Decorative Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-orange-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-40 w-[600px] h-[600px] bg-yellow-100/50 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Commercial Pitch */}
          <div className="space-y-6 lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200 text-xs md:text-sm font-extrabold">
              <span className="w-2.5 h-2.5 bg-orange-600 rounded-full animate-ping" />
              {t('hero.badge')}
            </div>
            
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-black leading-tight text-gray-900">
              {t('hero.title.1')}{' '}
              <span className="text-orange-500 font-extrabold relative inline-block">
                {t('hero.title.highlight')}
                <span className="absolute left-0 bottom-1 w-full h-2 bg-yellow-400 -z-10 rounded" />
              </span>{' '}
              {t('hero.title.2')}
            </h1>
            
            <p className="text-base md:text-lg text-gray-600 max-w-xl leading-relaxed">
              {t('hero.description')}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl px-8 text-base shadow-md transition-all duration-300 hover:shadow-lg active:scale-95">
                <Link to="/produtos">
                  {t('hero.cta.products')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-xl px-8 text-base border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-bold">
                <Link to="/frete">
                  {t('hero.cta.story')}
                </Link>
              </Button>
            </div>

            {/* Shopping Stats */}
            <div className="flex items-center gap-6 md:gap-8 pt-6 border-t border-gray-100">
              <div>
                <p className="text-2xl md:text-3xl font-black text-gray-900 flex items-center">
                  100%<span className="text-orange-500 text-sm font-bold ml-1">★</span>
                </p>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-0.5">{t('hero.stat.artesanal')}</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-2xl md:text-3xl font-black text-gray-900">7+</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-0.5">{t('hero.stat.flavors')}</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-2xl md:text-3xl font-black text-gray-900">27</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-0.5">{t('hero.stat.provinces')}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Banner */}
          <div className="lg:col-span-5 relative animate-fade-in">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-elevated border-4 border-white bg-gray-100">
              <img 
                src="https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=800&auto=format&fit=crop" 
                alt="Japanese Shopping District"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Trust badge 1: Remessa Conforme */}
            <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-card p-3 border border-gray-100 animate-float">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-extrabold text-[10px] text-green-600 uppercase tracking-wider">Remessa Conforme</p>
                  <p className="text-xs font-bold text-gray-800">Isento de Taxas &lt; $50</p>
                </div>
              </div>
            </div>

            {/* Trust badge 2: Tokyo flight */}
            <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-card p-3.5 border border-gray-100 animate-float" style={{ animationDelay: '2s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                  <PlaneTakeoff className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="font-extrabold text-[10px] text-orange-500 uppercase tracking-wider">{t('hero.badge.recipe')}</p>
                  <p className="text-xs font-bold text-gray-800">{t('hero.badge.tradition')}</p>
                </div>
              </div>
            </div>
            
            {/* Sakura flower petal effect overlay */}
            <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 text-[10px] font-black uppercase px-2.5 py-1 rounded shadow-sm flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} /> Promoção de Abertura
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;
