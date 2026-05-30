import React, { useState, useMemo, useEffect } from 'react';
import { Truck, Package, Calculator, MapPin } from 'lucide-react';
import { prefectures, shippingRates } from '@/data/prefectures';
import { japanPrefectures, japanShippingRates } from '@/data/japanPrefectures';
import { europePrefectures, europeShippingRates } from '@/data/europePrefectures';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/utils/currency';

interface ShippingCalculatorProps {
  selectedPrefecture?: string;
  onShippingSelect?: (shipping: { carrier: string; cost: number; estimatedDays: string } | null) => void;
  destinationCountry?: 'Brasil' | 'Japão' | 'Portugal' | 'França' | 'Itália' | 'Espanha';
  couponDiscount?: number;
}

const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({ 
  selectedPrefecture: externalPrefecture,
  onShippingSelect,
  destinationCountry = 'Brasil',
  couponDiscount = 0
}) => {
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>(externalPrefecture || '');
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const { getSpaceUsed, items } = useCart();
  const { t } = useLanguage();

  useEffect(() => {
    if (externalPrefecture) {
      setSelectedPrefecture(externalPrefecture);
    }
  }, [externalPrefecture]);

  // Reset selected prefecture when destination country changes
  useEffect(() => {
    setSelectedPrefecture('');
    setSelectedCarrier(null);
  }, [destinationCountry]);

  const spaceInfo = getSpaceUsed();
  
  const isJapan = destinationCountry === 'Japão';
  const isEurope = ['Portugal', 'França', 'Itália', 'Espanha'].includes(destinationCountry || '');
  const hasDoceDeLeite = items.length > 0;

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

  const activePrefectures = isJapan 
    ? japanPrefectures 
    : isEurope 
    ? europePrefectures[destinationCountry as string] || [] 
    : prefectures;

  const selectedPref = activePrefectures.find(p => p.name === selectedPrefecture);

  const displaySubtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const basePrice = item.size === 'small' ? item.product.prices.small : item.product.prices.large;
      let unitPrice = basePrice;
      if (isJapan) {
        unitPrice = basePrice;
      } else if (isEurope) {
        unitPrice = (basePrice / 28) * 0.16;
      } else {
        unitPrice = basePrice / 28; // BRL
      }
      return sum + unitPrice * item.quantity;
    }, 0);
  }, [items, isJapan, isEurope]);

  const finalAmountForFreeShipping = displaySubtotal - couponDiscount;
  const isFreeShipping = isJapan && hasDoceDeLeite && finalAmountForFreeShipping >= 6000;

  const shippingOptions = useMemo(() => {
    if (items.length === 0) return [];
    const options = [];

    if (selectedPref) {
      const zone = selectedPref.zone as 1 | 2 | 3 | 4;
      const carriers: ('yuubin' | 'yamato' | 'sagawa')[] = ['yuubin', 'yamato', 'sagawa'];

      if (isJapan) {
        // Japan local carriers
        const shippingCarriers = carriers.map(carrier => {
          let totalCost = 0;
          if (calculateBoxes.boxes60 > 0) totalCost += japanShippingRates[carrier]['60'][zone] * calculateBoxes.boxes60;
          if (calculateBoxes.boxes80 > 0) totalCost += japanShippingRates[carrier]['80'][zone] * calculateBoxes.boxes80;

          // If no boxes are somehow calculated but we have items, fallback to a single 60 box rate
          if (totalCost === 0 && items.length > 0) {
            totalCost = japanShippingRates[carrier]['60'][zone];
          }

          const carrierNames = {
            yuubin: { name: 'Japan Post Local (ゆうパック) ✉️', logo: '📮' },
            yamato: { name: 'Yamato Transport (宅急便) 🐱', logo: '📦' },
            sagawa: { name: 'Sagawa Express (飛脚宅配便) 🏃‍♂️', logo: '⚡' }
          };

          const cost = isFreeShipping ? 0 : totalCost;

          return {
            carrier,
            ...carrierNames[carrier],
            cost: cost,
            originalCost: isFreeShipping ? totalCost : undefined,
            estimatedDays: zone === 1 ? '1-2' : zone === 2 ? '1-2' : zone === 3 ? '2-3' : '3-4'
          };
        });

        options.push(...shippingCarriers);
      } else if (isEurope) {
        // Europe international carriers
        const shippingCarriers = carriers.map(carrier => {
          let totalCost = 0;
          const rates = europeShippingRates[carrier];
          if (calculateBoxes.boxes60 > 0) totalCost += rates['60'][zone] * calculateBoxes.boxes60;
          if (calculateBoxes.boxes80 > 0) totalCost += rates['80'][zone] * calculateBoxes.boxes80;

          if (totalCost === 0 && items.length > 0) {
            totalCost = rates['60'][zone];
          }

          const carrierNames = {
            yuubin: {
              name: destinationCountry === 'Portugal' ? 'Correios CTT Padrão 🇵🇹' 
                    : destinationCountry === 'França' ? 'La Poste Padrão 🇫🇷' 
                    : destinationCountry === 'Itália' ? 'Poste Italiane Padrão 🇮🇹' 
                    : 'Correos España Padrão 🇪🇸',
              logo: '✉️'
            },
            yamato: { name: 'Aéreo Expresso EMS (Tóquio-Europa) ✈️', logo: '✈️' },
            sagawa: { name: 'Priority Express Courier (DHL/FedEx) 🏃‍♂️', logo: '⚡' }
          };

          const deliveryTimes = {
            1: '7-10',  // Western/Major cities
            2: '9-13',  // Regional cities
            3: '12-16', // Island groups / remote
            4: '14-20'  // Distant islands
          };

          return {
            carrier,
            ...carrierNames[carrier],
            cost: totalCost * 0.16, // Convert BRL base cost to EUR
            estimatedDays: deliveryTimes[zone] || '10-15'
          };
        });

        options.push(...shippingCarriers);
      } else {
        // Brazil international carriers
        const shippingCarriers = carriers.map(carrier => {
          let totalCost = 0;
          if (calculateBoxes.boxes60 > 0) totalCost += shippingRates[carrier]['60'][zone] * calculateBoxes.boxes60;
          if (calculateBoxes.boxes80 > 0) totalCost += shippingRates[carrier]['80'][zone] * calculateBoxes.boxes80;

          // Fallback if totalCost is 0
          if (totalCost === 0 && items.length > 0) {
            totalCost = shippingRates[carrier]['60'][zone];
          }

          const carrierNames = {
            yuubin: { name: 'Correios PAC Padrão', logo: '📦' },
            yamato: { name: 'Aéreo Expresso EMS (Tóquio-Brasil)', logo: '✈️' },
            sagawa: { name: 'Priority Courier Internacional', logo: '⚡' }
          };

          const deliveryTimes = {
            1: '10-15', // Sudeste
            2: '12-18', // Sul / Centro-Oeste
            3: '15-20', // Nordeste
            4: '18-25'  // Norte
          };

          return {
            carrier,
            ...carrierNames[carrier],
            cost: totalCost,
            estimatedDays: deliveryTimes[zone] || '15-20'
          };
        });

        options.push(...shippingCarriers);
      }
    }

    // Sort by cost
    return options.sort((a, b) => a.cost - b.cost);
  }, [selectedPref, items, calculateBoxes, isJapan, isEurope, isFreeShipping, destinationCountry]);

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

  const currency = isJapan ? 'JPY' : (isEurope ? 'EUR' : 'BRL');

  return (
    <div className={cn("bg-card rounded-2xl border border-border p-6", !onShippingSelect && "lg:p-8")}>
      {!onShippingSelect && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-sans text-2xl font-bold text-foreground">
              {isJapan ? 'Calcular Frete Nacional' : 'Calcular Frete Internacional'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isJapan 
                ? 'De Mie para todo o Japão' 
                : isEurope 
                ? `Diretamente do Japão para ${destinationCountry}` 
                : 'Diretamente do Japão para o Brasil'}
            </p>
          </div>
        </div>
      )}

      {/* Prefecture/State/Region Selection */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-foreground mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          {isJapan 
            ? 'Selecione a Província Japonesa' 
            : isEurope 
            ? `Selecione a Região de destino em ${destinationCountry}` 
            : 'Selecione o Estado Brasileiro'}
          <span className="text-muted-foreground text-xs ml-2">
            ({isJapan ? 'Envio Local' : 'Aéreo Direto'})
          </span>
        </label>
        <select
          value={selectedPrefecture}
          onChange={(e) => { setSelectedPrefecture(e.target.value); setSelectedCarrier(null); }}
          disabled={!!externalPrefecture}
          className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <option value="">
            {isJapan 
              ? 'Escolha a Província...' 
              : isEurope 
              ? 'Escolha a Região/Distrito...' 
              : 'Escolha o Estado...'}
          </option>
          {activePrefectures.map((pref) => (
            <option key={pref.name} value={pref.name}>
              {pref.nameJa} ({pref.name})
            </option>
          ))}
        </select>
      </div>

      {/* Free Shipping Promotion Banner for Japan Sakura Express */}
      {isFreeShipping && items.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 rounded-xl p-4 mb-6 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌸</span>
            <h3 className="font-bold text-emerald-800 dark:text-emerald-200">Frete Local Grátis!</h3>
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            Benefício Sakura Express: Envio 100% gratuito para entregas no território japonês.
          </p>
        </div>
      )}

      {isJapan && hasDoceDeLeite && !isFreeShipping && items.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 mb-6 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌸</span>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">Frete Grátis acima de ¥6.000</h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            O frete local é gratuito para compras de produtos Sakura Express acima de ¥6.000. Falta apenas {formatPrice(6000 - finalAmountForFreeShipping, 'JPY')} para obter o frete grátis.
          </p>
        </div>
      )}

      {/* Alert for international shipping cost */}
      {!isJapan && items.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-4 mb-6 border border-orange-200">
          <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold leading-relaxed">
            ✈️ Envio Aéreo de Tóquio para {isEurope ? destinationCountry : 'o Brasil'}: O frete internacional é calculado por volume de caixas e peso. Não elegível para frete grátis.
          </p>
        </div>
      )}

      {/* Cart Summary */}
      {items.length > 0 && (
        <div className="bg-secondary/50 rounded-xl p-4 mb-6 border border-border">
          <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            {t('calc.yourOrder')}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens Padrão (Padrão)</span>
              <span className="font-medium">{spaceInfo.small}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens Premium (Deluxe)</span>
              <span className="font-medium">{spaceInfo.large}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caixas 60cm estimadas:</span>
                <span className="font-medium">{calculateBoxes.boxes60}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caixas 80cm estimadas:</span>
                <span className="font-medium">{calculateBoxes.boxes80}</span>
              </div>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between text-foreground font-bold">
                <span>{t('calc.subtotal')}</span>
                <span>{formatPrice(displaySubtotal, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Results */}
      {items.length > 0 && shippingOptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {onShippingSelect ? t('calc.selectDelivery') : t('calc.deliveryOptions')}
            {selectedPrefecture && ` para ${selectedPref?.nameJa}`}
          </h3>
          
          {!selectedPrefecture && onShippingSelect && (
            <p className="text-sm text-muted-foreground mb-3">Selecione uma província ou estado acima.</p>
          )}
          
          {shippingOptions.map((option, index) => (
            <div 
              key={option.carrier}
              onClick={() => onShippingSelect && handleCarrierSelect(option.carrier)}
              className={cn(
                    selectedCarrier === option.carrier
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : onShippingSelect
                  ? "border-border hover:border-primary/50"
                  : index === 0 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
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
                    <p className="font-bold text-sm text-foreground">{option.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {`Entrega estimada em ${option.estimatedDays} dias úteis`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-sans text-lg font-black",
                    option.cost === 0 ? "text-green-600" : "text-primary"
                  )}>
                    {option.cost === 0 ? 'Grátis' : formatPrice(option.cost, currency)}
                  </p>
                  {option.originalCost && option.originalCost > 0 && (
                    <p className="text-xs text-muted-foreground line-through">{formatPrice(option.originalCost, currency)}</p>
                  )}
                  {option.cost === 0 && option.originalCost && (
                    <span className="text-[10px] text-emerald-600 font-bold block">✓ Doce de Leite Japão</span>
                  )}
                  {!onShippingSelect && index === 0 && (
                    <span className="text-xs text-primary font-bold">Melhor Opção</span>
                  )}
                  {selectedCarrier === option.carrier && (
                    <span className="text-xs text-primary font-bold">{t('calc.selected')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!onShippingSelect && (
            <div className="bg-primary text-primary-foreground rounded-xl p-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold">{t('calc.totalBest')}</span>
                <span className="font-sans text-2xl font-black">
                  {formatPrice(displaySubtotal + shippingOptions[0].cost, currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50 text-orange-500" />
          <p>{t('calc.emptyCart')}</p>
        </div>
      )}
    </div>
  );
};

export default ShippingCalculator;