import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/context/ProductsContext';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslatedProductDesc } from '@/data/translations';
import { i18nDesc } from '@/utils/productI18n';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen, baseYen, hasDiscount } from '@/utils/pricing';
import { convertYen as fxConvert } from '@/services/fxService';
import { cn } from '@/lib/utils';
import { productEnglishName } from '@/utils/productName';

const FeaturedProducts: React.FC = () => {
  const { t, language, selectedCountry } = useLanguage();
  const { products, loading } = useProducts();
  const featuredProducts = products.filter(p => !p.hidden).slice(0, 4);

  const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(selectedCountry);
  const currency = getCurrencyByCountry(selectedCountry);
  const getDisplayPrice = (val: number) => fxConvert(val, currency);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
            <Sparkles className="w-4 h-4" />
            {t('featured.badge')}
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900">
            {t('featured.title')}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            {t('featured.subtitle')}
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
          {loading ? Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-secondary" />
              <div className="p-3 md:p-4 space-y-3">
                <div className="h-4 bg-secondary rounded w-4/5" />
                <div className="h-3 bg-secondary rounded w-full" />
                <div className="h-6 bg-secondary rounded w-2/3" />
              </div>
            </div>
          )) : featuredProducts.map((product) => {
            const promo = hasDiscount(product);
            const smallPrice = getDisplayPrice(effectiveYen(product, 'small'));
            const smallOriginal = getDisplayPrice(baseYen(product, 'small'));

            return (
              <Link
                key={product.id}
                to={`/produto/${product.id}`}
                className="group bg-gray-50 border border-gray-100 rounded-xl overflow-hidden shadow-soft hover:shadow-card hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {/* Image Section */}
                <div className="aspect-square bg-white relative overflow-hidden">
                  <img
                    src={product.thumbnail || product.image}
                    alt={productEnglishName(product)}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {promo && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                        -{product.discountPercent}%
                      </span>
                    </div>
                  )}

                  {/* Origin Tag (real, não fake) */}
                  <div className="absolute top-2 left-2">
                    {selectedCountry === 'Japão' ? (
                      <span className="bg-green-600 text-white font-black text-[9px] px-2 py-0.5 rounded shadow-sm tracking-wider uppercase">
                        {t('featured.tag.domestic')} 🇯🇵
                      </span>
                    ) : (
                      <span className="bg-primary text-white font-black text-[9px] px-2 py-0.5 rounded shadow-sm tracking-wider uppercase">
                        {t('featured.tag.imported')} ✈️
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-sans font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-primary transition-colors">
                      {productEnglishName(product)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {i18nDesc(product, language) || getTranslatedProductDesc(product.id, t)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="flex items-baseline gap-1.5">
                      <span className={cn('text-lg md:text-xl font-bold', promo ? 'text-red-600' : 'text-primary')}>
                        {formatPrice(smallPrice, currency)}
                      </span>
                      {promo && (
                        <span className="text-[11px] font-semibold text-gray-500 line-through">
                          {formatPrice(smallOriginal, currency)}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] font-medium text-primary group-hover:underline">
                      {t('featured.details')}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* View All CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="btn-primary font-bold rounded-full px-8 shadow-md">
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
