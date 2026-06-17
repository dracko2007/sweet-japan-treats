import React, { useState, useMemo, useEffect } from 'react';
import { Truck, Package, Calculator, MapPin, Scale } from 'lucide-react';
import { japanPrefectures, japanShippingRates } from '@/data/japanPrefectures';
import { useCart } from '@/context/CartContext';
import { convertYen as fxConvert } from '@/services/fxService';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/utils/currency';
import { calculateCartShippingBoxes } from '@/utils/shippingDimensions';
import { getELightRate, getKozutsumiRate, getEmsRate, MAX_WEIGHT_G, MAX_DIM_SUM_CM, type JapanPostZone } from '@/utils/japanPostRates';

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
    if (externalPrefecture) setSelectedPrefecture(externalPrefecture);
  }, [externalPrefecture]);

  useEffect(() => {
    setSelectedPrefecture('');
    setSelectedCarrier(null);
  }, [destinationCountry]);

  const spaceInfo = getSpaceUsed();

  const isJapan = destinationCountry === 'Japão';
  const isEurope = ['Portugal', 'França', 'Itália', 'Espanha'].includes(destinationCountry || '');
  const jpZone: JapanPostZone = isEurope ? 3 : 5;

  const calculateBoxes = useMemo(
    () => calculateCartShippingBoxes(items, spaceInfo),
    [items, spaceInfo]
  );

  const selectedPref = isJapan
    ? japanPrefectures.find(p => p.name === selectedPrefecture)
    : undefined;

  const displaySubtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const basePrice = item.size === 'small' ? item.product.prices.small : item.product.prices.large;
      const cur = isJapan ? 'JPY' : isEurope ? 'EUR' : 'BRL';
      const unitPrice = fxConvert(basePrice, cur);
      return sum + unitPrice * item.quantity;
    }, 0);
  }, [items, isJapan, isEurope]);

  const finalAmountForFreeShipping = displaySubtotal - couponDiscount;
  const isFreeShipping = isJapan && items.length > 0 && finalAmountForFreeShipping >= 6000;

  const shippingOptions = useMemo(() => {
    if (items.length === 0) return [];

    if (isJapan) {
      if (!selectedPref) return [];
      const zone = selectedPref.zone as 1 | 2 | 3 | 4;
      const carriers: ('yuubin' | 'yamato' | 'sagawa')[] = ['yuubin', 'yamato', 'sagawa'];
      const carrierNames = {
        yuubin: { name: 'Japan Post Local (ゆうパック) ✉️', logo: '📮' },
        yamato: { name: 'Yamato Transport (宅急便) 🐱', logo: '📦' },
        sagawa: { name: 'Sagawa Express (飛脚宅配便) 🏃‍♂️', logo: '⚡' }
      };
      const deliveryDays = { 1: '1-2', 2: '1-2', 3: '2-3', 4: '3-4' };

      return carriers.map(carrier => {
        let totalCost = 0;
        if (calculateBoxes.boxes60 > 0) totalCost += japanShippingRates[carrier]['60'][zone] * calculateBoxes.boxes60;
        if (calculateBoxes.boxes80 > 0) totalCost += japanShippingRates[carrier]['80'][zone] * calculateBoxes.boxes80;
        if (totalCost === 0) totalCost = japanShippingRates[carrier]['60'][zone];
        const cost = isFreeShipping ? 0 : totalCost;
        return {
          carrier,
          ...carrierNames[carrier],
          cost,
          costYen: null as number | null,
          originalCost: isFreeShipping ? totalCost : undefined,
          estimatedDays: deliveryDays[zone] || '2-3',
        };
      }).sort((a, b) => a.cost - b.cost);
    }

    // International — Japan Post weight-based
    const weightG = calculateBoxes.totalWeightG;
    if (weightG <= 0) return [];
    const currency = isEurope ? 'EUR' : 'BRL';

    if (weightG > MAX_WEIGHT_G) return []; // overweight — handled in JSX

    const options: Array<{
      carrier: string; name: string; logo: string;
      cost: number; costYen: number | null;
      originalCost: number | undefined; estimatedDays: string;
      isConsultar?: boolean;
    }> = [];

    if (weightG <= 2000) {
      const eLightYen = getELightRate(weightG, jpZone);
      if (eLightYen) options.push({
        carrier: 'eraito',
        name: 'Japan Post e-Raito · 国際eパケットライト',
        logo: '✉️',
        cost: fxConvert(eLightYen, currency),
        costYen: eLightYen,
        originalCost: undefined,
        estimatedDays: isEurope ? '7-12' : '10-15',
      });
    } else {
      const salYen = getKozutsumiRate(weightG, jpZone, 'sal');
      if (salYen) options.push({
        carrier: 'kozutsumi-sal',
        name: 'Japan Post SAL · 国際小包 エコノミー航空',
        logo: '📦',
        cost: fxConvert(salYen, currency),
        costYen: salYen,
        originalCost: undefined,
        estimatedDays: isEurope ? '15-30' : '20-45',
      });

      const airYen = getKozutsumiRate(weightG, jpZone, 'air');
      if (airYen) options.push({
        carrier: 'kozutsumi-air',
        name: 'Japan Post Kozutsumi Aéreo · 国際小包 航空便',
        logo: '📦',
        cost: fxConvert(airYen, currency),
        costYen: airYen,
        originalCost: undefined,
        estimatedDays: isEurope ? '7-10' : '10-15',
      });
    }

    // EMS available for all weight classes
    const emsYen = getEmsRate(weightG, jpZone);
    if (emsYen) options.push({
      carrier: 'ems',
      name: 'Japan Post EMS · 国際スピード郵便 (via DHL)',
      logo: '✈️',
      cost: fxConvert(emsYen, currency),
      costYen: emsYen,
      originalCost: undefined,
      estimatedDays: isEurope ? '5-8' : '7-12',
    });

    // Maritime — always show as "Consultar"
    options.push({
      carrier: 'maritimo',
      name: 'Marítimo · Encomenda por Navio',
      logo: '🚢',
      cost: 0,
      costYen: null,
      originalCost: undefined,
      estimatedDays: '60-90',
      isConsultar: true,
    });

    return options.sort((a, b) => {
      if (a.isConsultar) return 1;
      if (b.isConsultar) return -1;
      return a.cost - b.cost;
    });
  }, [selectedPref, items, calculateBoxes, isJapan, isEurope, jpZone, isFreeShipping]);

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

  const currency = isJapan ? 'JPY' : (isEurope ? 'EUR' : 'BRL');

  const weightG = calculateBoxes.totalWeightG;
  const weightLabel = weightG >= 1000
    ? `${(weightG / 1000).toFixed(2).replace(/\.0+$/, '')} kg`
    : `${weightG} g`;
  const isOverweight = !isJapan && weightG > MAX_WEIGHT_G;
  const isOversize = !isJapan && calculateBoxes.maxPaddedDimensionSumCm > MAX_DIM_SUM_CM;

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
                ? 'De Hiroshima para todo o Japão'
                : `Diretamente do Japão para ${destinationCountry}`}
            </p>
          </div>
        </div>
      )}

      {/* Prefecture selector — Japan domestic only */}
      {isJapan && (
        <div className="mb-6">
          <label className="block text-sm font-bold text-foreground mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            Selecione a Província Japonesa
            <span className="text-muted-foreground text-xs ml-2">(Envio Local)</span>
          </label>
          <select
            value={selectedPrefecture}
            onChange={(e) => { setSelectedPrefecture(e.target.value); setSelectedCarrier(null); }}
            disabled={!!externalPrefecture}
            className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <option value="">Escolha a Província...</option>
            {japanPrefectures.map((pref) => (
              <option key={pref.name} value={pref.name}>
                {pref.nameJa} ({pref.name})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Japan Post international zone info */}
      {!isJapan && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
            🗾 Japan Post Internacional · Zona {jpZone}
            <span className="text-xs font-normal text-blue-600 dark:text-blue-400">
              — {isEurope ? `${destinationCountry} (Europa)` : 'Brasil (América do Sul)'}
            </span>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Serviço determinado pelo peso total estimado do pedido.
          </p>
        </div>
      )}

      {/* Free Shipping Banner */}
      {isFreeShipping && items.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 rounded-xl p-4 mb-6 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌸</span>
            <h3 className="font-bold text-emerald-800 dark:text-emerald-200">Frete Local Grátis!</h3>
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            Benefício Japan Express: Envio 100% gratuito para entregas no território japonês.
          </p>
        </div>
      )}

      {isJapan && items.length > 0 && !isFreeShipping && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 mb-6 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌸</span>
            <h3 className="font-bold text-amber-800 dark:text-amber-200">Frete Grátis acima de ¥6.000</h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Falta {formatPrice(6000 - finalAmountForFreeShipping, 'JPY')} para frete grátis.
          </p>
        </div>
      )}

      {/* International shipping note */}
      {!isJapan && items.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-4 mb-6 border border-orange-200">
          <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold leading-relaxed">
            ✈️ Envio de Tóquio para {destinationCountry}: frete calculado pelo Japan Post, com base no peso estimado. Não elegível para frete grátis.
          </p>
        </div>
      )}

      {/* Overweight / oversize warnings */}
      {isOverweight && items.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-6 border border-red-200">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">
            ⚠️ Pedido excede 30 kg ({weightLabel}) — limite máximo Japan Post.
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Entre em contato para envios especiais.</p>
        </div>
      )}
      {isOversize && items.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-6 border border-red-200">
          <p className="text-sm font-bold text-red-700 dark:text-red-300">
            ⚠️ Dimensões excedem o limite de 150 cm (A+L+P) — Japan Post não aceita.
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Entre em contato para envio especial via courier privado.</p>
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
              <span className="text-muted-foreground">Itens Padrão</span>
              <span className="font-medium">{spaceInfo.small}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens Premium</span>
              <span className="font-medium">{spaceInfo.large}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              {isJapan ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Caixas 60 cm estimadas:</span>
                    <span className="font-medium">{calculateBoxes.boxes60}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Caixas 80 cm estimadas:</span>
                    <span className="font-medium">{calculateBoxes.boxes80}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5" /> Peso estimado:
                  </span>
                  <span className="font-bold text-foreground">{weightLabel}</span>
                </div>
              )}
              {calculateBoxes.usedRealDimensions && (
                <div className="rounded-lg bg-background/70 border border-border p-2 text-[11px] text-muted-foreground leading-relaxed mt-1">
                  Calculado com medidas reais de embalagem + margem de +{calculateBoxes.safetyMarginCm} cm.
                  {calculateBoxes.missingDimensionsCount > 0 && (
                    <span className="block text-amber-700 dark:text-amber-300">
                      {calculateBoxes.missingDimensionsCount} item(ns) sem medida real — peso estimado por padrão.
                    </span>
                  )}
                </div>
              )}
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
      {items.length > 0 && !isOverweight && !isOversize && shippingOptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {onShippingSelect ? t('calc.selectDelivery') : t('calc.deliveryOptions')}
            {isJapan && selectedPrefecture && ` para ${selectedPref?.nameJa}`}
          </h3>

          {isJapan && !selectedPrefecture && onShippingSelect && (
            <p className="text-sm text-muted-foreground mb-3">Selecione uma província acima.</p>
          )}

          {shippingOptions.map((option, index) => {
            const isConsultar = (option as any).isConsultar;
            return (
              <div
                key={option.carrier}
                onClick={() => onShippingSelect && !isConsultar && setSelectedCarrier(option.carrier)}
                className={cn(
                  "rounded-xl p-4 border transition-all",
                  onShippingSelect && !isConsultar ? "cursor-pointer" : "",
                  isConsultar ? "border-dashed border-border opacity-70" :
                  selectedCarrier === option.carrier
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : onShippingSelect
                    ? "border-border hover:border-primary/50"
                    : index === 0
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {onShippingSelect && !isConsultar && (
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                        selectedCarrier === option.carrier ? "border-primary bg-primary" : "border-border"
                      )}>
                        {selectedCarrier === option.carrier && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    )}
                    <span className="text-2xl">{option.logo}</span>
                    <div>
                      <p className="font-bold text-sm text-foreground">{option.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.costYen ? `¥${option.costYen.toLocaleString()} · ` : ''}
                        {isConsultar ? 'Prazo variável conforme rota' : `Entrega em ${option.estimatedDays} dias úteis`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isConsultar ? (
                      <p className="font-sans text-sm font-black text-muted-foreground">Consultar</p>
                    ) : (
                      <p className={cn(
                        "font-sans text-lg font-black",
                        option.cost === 0 ? "text-green-600" : "text-primary"
                      )}>
                        {option.cost === 0 ? 'Grátis' : formatPrice(option.cost, currency)}
                      </p>
                    )}
                    {option.originalCost && option.originalCost > 0 && (
                      <p className="text-xs text-muted-foreground line-through">{formatPrice(option.originalCost, currency)}</p>
                    )}
                    {!onShippingSelect && !isConsultar && index === 0 && (
                      <span className="text-xs text-primary font-bold">Melhor Opção</span>
                    )}
                    {selectedCarrier === option.carrier && !isConsultar && (
                      <span className="text-xs text-primary font-bold">{t('calc.selected')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!onShippingSelect && (() => {
            const best = shippingOptions.find(o => !(o as any).isConsultar);
            if (!best) return null;
            return (
              <div className="bg-primary text-primary-foreground rounded-xl p-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold">{t('calc.totalBest')}</span>
                  <span className="font-sans text-2xl font-black">
                    {formatPrice(displaySubtotal + best.cost, currency)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Needs prefecture selection (Japan) */}
      {isJapan && items.length > 0 && !selectedPrefecture && shippingOptions.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Selecione a província para ver as opções de envio.
        </div>
      )}

      {/* Empty cart */}
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
