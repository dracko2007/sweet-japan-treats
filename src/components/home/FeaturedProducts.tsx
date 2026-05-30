import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Flame, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { products } from '@/data/products';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslatedProductName, getTranslatedProductDesc } from '@/data/translations';
import { formatPrice } from '@/utils/currency';

// Generate static fake remaining stock percentages for high-conversion design
const FAKE_STOCK_PERCENT: Record<string, number> = {
  'biore-uv': 84,
  'kitkat-matcha': 92,
  'luffy-figure': 67,
  'kawaii-lamp': 75,
  'sakura-pens': 88,
  'muji-organizer': 59,
  'sencha-tea': 63,
};

const FeaturedProducts: React.FC = () => {
  const { t, selectedCountry } = useLanguage();
  const featuredProducts = products.slice(0, 4);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ hours: 1, minutes: 48, seconds: 26 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          return { hours: 2, minutes: 0, seconds: 0 }; // Reset
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        {/* Temu-Style Lightning Deals Header Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-12 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white animate-pulse">
              <Flame className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full uppercase">Ofertas Relâmpago</span>
                <span className="text-orange-500 font-extrabold text-sm">-90% OFF EXTRA</span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-gray-900 mt-1">
                Leva tudo direto do Japão
              </h2>
            </div>
          </div>

          {/* Countdown Clock */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-600 uppercase flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-orange-500" /> Termina em:
            </span>
            <div className="flex items-center gap-1">
              <span className="bg-gray-900 text-white font-mono font-extrabold text-lg px-2.5 py-1.5 rounded-lg shadow-sm">
                {timeLeft.hours.toString().padStart(2, '0')}
              </span>
              <span className="font-bold text-gray-800 text-xl">:</span>
              <span className="bg-gray-900 text-white font-mono font-extrabold text-lg px-2.5 py-1.5 rounded-lg shadow-sm">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </span>
              <span className="font-bold text-gray-800 text-xl">:</span>
              <span className="bg-orange-600 text-white font-mono font-extrabold text-lg px-2.5 py-1.5 rounded-lg shadow-sm animate-pulse">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
          {featuredProducts.map((product, index) => {
            const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(selectedCountry);
            const currency = selectedCountry === 'Japão' ? 'JPY' : (isEuro ? 'EUR' : 'BRL');
            const getDisplayPrice = (val: number) => {
              if (selectedCountry === 'Japão') return val;
              if (isEuro) return (val / 28) * 0.16;
              return val / 28;
            };
            const smallPrice = getDisplayPrice(product.prices.small);
            const originalPrice = smallPrice * 2.5;
            const stockPercent = FAKE_STOCK_PERCENT[product.id] || 75;

            return (
              <Link
                key={product.id}
                to={`/produto/${product.id}`}
                className="group bg-gray-50 border border-gray-100 rounded-xl overflow-hidden shadow-soft hover:shadow-card hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image Section */}
                <div className="aspect-square bg-white relative overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Free Shipping / Origin Tag */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                    {selectedCountry === 'Japão' ? (
                      <span className="bg-green-600 text-white font-black text-[9px] px-2 py-0.5 rounded shadow-sm tracking-wider uppercase">
                        Envio Doméstico (Mie) 🇯🇵
                      </span>
                    ) : (
                      <span className="bg-orange-600 text-white font-black text-[9px] px-2 py-0.5 rounded shadow-sm tracking-wider uppercase">
                        Importado Aéreo ✈️
                      </span>
                    )}
                    <span className="bg-yellow-400 text-gray-900 font-extrabold text-[9px] px-2 py-0.5 rounded shadow-sm tracking-wider uppercase">
                      -{Math.floor((1 - (product.prices.small / (product.prices.small * 2.5))) * 100)}%
                    </span>
                  </div>

                  {/* Rating Overlay */}
                  <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm border border-gray-200">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>5.0 ({120 + index * 14})</span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-sans font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-primary transition-colors">
                      {getTranslatedProductName(product.id, t)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {getTranslatedProductDesc(product.id, t)}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    {/* Stock Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                        <span>Restam poucos!</span>
                        <span className="font-bold text-orange-600">{100 - stockPercent}% Restantes</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" 
                          style={{ width: `${stockPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Price display */}
                    <div className="flex items-baseline justify-between gap-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg md:text-xl font-black text-orange-600">
                          {formatPrice(smallPrice, currency)}
                        </span>
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(originalPrice, currency)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        Original
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* View All CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full px-8 shadow-md">
            <Link to="/produtos">
              {t('featured.viewAll')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
