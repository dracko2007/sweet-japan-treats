import React, { useState, useMemo, useEffect } from 'react';
import { Truck, Package, Calculator, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prefectures, shippingRates, CarrierName, BoxSize } from '@/data/prefectures';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

interface ShippingCalculatorProps {
  selectedPrefecture?: string;
  onShippingSelect?: (shipping: { carrier: string; cost: number; estimatedDays: string } | null) => void;
}

const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({ 
  selectedPrefecture: externalPrefecture,
  onShippingSelect 
}) => {
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>(externalPrefecture || '');
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const { getSpaceUsed, items, totalPrice } = useCart();
  const { t } = useLanguage();

  useEffect(() => {
    if (externalPrefecture) {
      setSelectedPrefecture(externalPrefecture);
    }
  }, [externalPrefecture]);

  const spaceInfo = getSpaceUsed();
  
  const isAnniversaryPromo = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const isPromoMonth = currentMonth === 10 || currentMonth === 11;
    const hasEnoughLargePots = spaceInfo.large >= 3;
    const hasEnoughValue = totalPrice >= 5000;
    return isPromoMonth && (hasEnoughLargePots || hasEnoughValue);
  }, [spaceInfo.large, totalPrice]);

  const calculateBoxes = useMemo(() => {
    if (items.length === 0) return { boxes60: 0, boxes80: 0 };
    const totalSmallEq = spaceInfo.totalSmallEquivalent;
    if (totalSmallEq <= 4) return { boxes60: 1, boxes80: 0 };
    else if (totalSmallEq <= 6) return { boxes60: 0, boxes80: 1 };
    else if (totalSmallEq <= 8) return { boxes60: 2, boxes80: 0 };
    else {
      const boxes80Needed = Math.floor(totalSmallEq / 6);
      const remaining = totalSmallEq % 6;
      const boxes60Needed = remaining > 0 ? Math.ceil(remaining / 4) : 0;
      return { boxes60: boxes60Needed, boxes80: boxes80Needed };
    }
  }, [items, spaceInfo.totalSmallEquivalent]);

  const selectedPref = prefectures.find(p => p.name === selectedPrefecture);

  const shippingOptions = useMemo(() => {
    if (items.length === 0) return [];
    const options = [];

    options.push({
      carrier: 'pickup',
      name: t('calc.pickupName'),
      logo: '🏪',
      cost: 0,
      estimatedDays: t('calc.arrange')
    });

    if (selectedPref) {
      const zone = selectedPref.zone as 1 | 2 | 3 | 4;
      const carriers: CarrierName[] = ['yuubin', 'yamato', 'sagawa'];
      
      const shippingCarriers = carriers.map(carrier => {
        let totalCost = 0;
        if (calculateBoxes.boxes60 > 0) totalCost += shippingRates[carrier]['60'][zone] * calculateBoxes.boxes60;
        if (calculateBoxes.boxes80 > 0) totalCost += shippingRates[carrier]['80'][zone] * calculateBoxes.boxes80;

        const carrierNames = {
          yuubin: { name: 'Japan Post (ゆうパック)', logo: '📮' },
          yamato: { name: 'Yamato (クロネコ)', logo: '🐱' },
          sagawa: { name: 'Sagawa (佐川急便)', logo: '📦' }
        };

        return {
          carrier,
          ...carrierNames[carrier],
          cost: isAnniversaryPromo ? 0 : totalCost,
          originalCost: isAnniversaryPromo ? totalCost : undefined,
          estimatedDays: zone === 1 ? '1-2' : zone === 2 ? '2-3' : '3-4'
        };
      });

      options.push(...shippingCarriers);
    }

    return options.sort((a, b) => a.cost - b.cost);
  }, [selectedPref, items, calculateBoxes, t, isAnniversaryPromo]);

  useEffect(() => {
    if (onShippingSelect && selectedCarrier && shippingOptions.length > 0) {
      const selected = shippingOptions.find(opt => opt.carrier === selectedCarrier);
      if (selected) {
        onShippingSelect({ carrier: selected.name, cost: selected.cost, estimatedDays: selected.estimatedDays });
      }
    } else if (onShippingSelect && !selectedCarrier) {
      onShippingSelect(null);
    }
  }, [selectedCarrier, shippingOptions, onShippingSelect]);

  const handleCarrierSelect = (carrier: string) => {
    setSelectedCarrier(carrier);
  };

  return (
    <div className={cn("bg-card rounded-2xl shadow-card p-6", !onShippingSelect && "lg:p-8")}>
      {!onShippingSelect && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full gradient-caramel flex items-center justify-center">
            <Calculator className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">{t('calc.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('calc.subtitle')}</p>
          </div>
        </div>
      )}

      {/* Prefecture Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          {externalPrefecture ? t('calc.selectedProvince') : t('calc.selectProvince')}
          <span className="text-muted-foreground text-xs ml-2">
            {t('calc.optionalPickup')}
          </span>
        </label>
        <select
          value={selectedPrefecture}
          onChange={(e) => { setSelectedPrefecture(e.target.value); setSelectedCarrier(null); }}
          disabled={!!externalPrefecture}
          className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{t('calc.chooseProv')}</option>
          {prefectures.map((pref) => (
            <option key={pref.name} value={pref.name}>
              {pref.nameJa} ({pref.name})
            </option>
          ))}
        </select>
      </div>

      {/* Anniversary Promotion Banner */}
      {isAnniversaryPromo && items.length > 0 && (
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950 dark:to-orange-950 rounded-xl p-4 mb-6 border-2 border-amber-400 dark:border-amber-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎂</span>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">{t('calc.promoTitle')}</h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">{t('calc.promoDesc')}</p>
        </div>
      )}

      {/* Cart Summary */}
      {items.length > 0 && (
        <div className="bg-secondary/50 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            {t('calc.yourOrder')}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc.smallPots')}</span>
              <span className="font-medium">{spaceInfo.small}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('calc.largePots')}</span>
              <span className="font-medium">{spaceInfo.large}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('calc.boxes60')}</span>
                <span className="font-medium">{calculateBoxes.boxes60}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('calc.boxes80')}</span>
                <span className="font-medium">{calculateBoxes.boxes80}</span>
              </div>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between text-foreground font-semibold">
                <span>{t('calc.subtotal')}</span>
                <span>¥{totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Results */}
      {items.length > 0 && shippingOptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {onShippingSelect ? t('calc.selectDelivery') : t('calc.deliveryOptions')}
            {selectedPrefecture && ` ${t('calc.deliveryTo')} ${selectedPref?.nameJa}`}
          </h3>
          
          {!selectedPrefecture && onShippingSelect && (
            <p className="text-sm text-muted-foreground mb-3">{t('calc.selectProvHint')}</p>
          )}
          
          {shippingOptions.map((option, index) => (
            <div 
              key={option.carrier}
              onClick={() => onShippingSelect && handleCarrierSelect(option.carrier)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                onShippingSelect && "cursor-pointer",
                selectedCarrier === option.carrier
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : onShippingSelect
                  ? "border-border hover:border-primary/50"
                  : index === 0 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50",
                option.carrier === 'pickup' && "bg-green-50 dark:bg-green-950/20 border-green-500"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {onShippingSelect && (
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      selectedCarrier === option.carrier ? "border-primary bg-primary" : "border-border"
                    )}>
                      {selectedCarrier === option.carrier && <div className="w-2 h-2 rounded-full bg-white"></div>}
                    </div>
                  )}
                  <span className="text-2xl">{option.logo}</span>
                  <div>
                    <p className="font-medium text-foreground">{option.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {option.carrier === 'pickup' ? t('calc.pickupLocation') : `${option.estimatedDays} ${t('calc.businessDays')}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-display text-xl font-bold",
                    option.carrier === 'pickup' ? "text-green-600" : 
                    option.cost === 0 && option.originalCost ? "text-green-600" : "text-primary"
                  )}>
                    {option.cost === 0 ? t('calc.free') : `¥${option.cost.toLocaleString()}`}
                  </p>
                  {option.originalCost && option.originalCost > 0 && (
                    <p className="text-xs text-muted-foreground line-through">¥{option.originalCost.toLocaleString()}</p>
                  )}
                  {option.cost === 0 && option.originalCost && (
                    <span className="text-xs text-amber-600 font-medium">{t('calc.anniversary')}</span>
                  )}
                  {!onShippingSelect && index === 0 && option.carrier !== 'pickup' && !isAnniversaryPromo && (
                    <span className="text-xs text-primary font-medium">{t('calc.cheapest')}</span>
                  )}
                  {!onShippingSelect && option.carrier === 'pickup' && (
                    <span className="text-xs text-green-600 font-medium">{t('calc.noShipping')}</span>
                  )}
                  {selectedCarrier === option.carrier && (
                    <span className="text-xs text-primary font-medium">{t('calc.selected')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!onShippingSelect && (
            <div className="bg-accent text-accent-foreground rounded-xl p-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">{t('calc.totalBest')}</span>
                <span className="font-display text-2xl font-bold">
                  ¥{(totalPrice + shippingOptions[0].cost).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('calc.emptyCart')}</p>
        </div>
      )}
    </div>
  );
};

export default ShippingCalculator;