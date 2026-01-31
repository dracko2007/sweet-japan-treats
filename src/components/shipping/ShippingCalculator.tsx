import React, { useState, useMemo } from 'react';
import { Truck, Package, Calculator, MapPin, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prefectures, shippingRates, CarrierName, BoxSize, carrierInfo } from '@/data/prefectures';
import { useCart } from '@/context/CartContext';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const ShippingCalculator: React.FC = () => {
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>('');
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierName | null>(null);
  const [selectedDeliveryTime, setSelectedDeliveryTime] = useState<string>('');
  const { getSpaceUsed, items, totalPrice } = useCart();

  const spaceInfo = getSpaceUsed();
  
  // Calculate required boxes based on CORRECTED formula
  // 1 large pot = 2 small pots
  // Box 60cm: 2 large pots (4 small pots)
  // Box 80cm: 3 large pots (6 small pots)
  // Box 100cm: 6 large pots (12 small pots)
  const calculateBoxes = useMemo(() => {
    if (items.length === 0) return { boxes60: 0, boxes80: 0, boxes100: 0 };
    
    const totalSmallEq = spaceInfo.totalSmallEquivalent;
    
    // Optimal packing strategy
    if (totalSmallEq <= 4) {
      // Fits in 60cm box
      return { boxes60: 1, boxes80: 0, boxes100: 0 };
    } else if (totalSmallEq <= 6) {
      // Fits in 80cm box
      return { boxes60: 0, boxes80: 1, boxes100: 0 };
    } else if (totalSmallEq <= 12) {
      // Fits in 100cm box
      return { boxes60: 0, boxes80: 0, boxes100: 1 };
    } else {
      // Need multiple boxes - use 100cm boxes first, then smaller ones
      const boxes100Needed = Math.floor(totalSmallEq / 12);
      const remaining = totalSmallEq % 12;
      
      if (remaining === 0) {
        return { boxes60: 0, boxes80: 0, boxes100: boxes100Needed };
      } else if (remaining <= 4) {
        return { boxes60: 1, boxes80: 0, boxes100: boxes100Needed };
      } else if (remaining <= 6) {
        return { boxes60: 0, boxes80: 1, boxes100: boxes100Needed };
      } else {
        // remaining > 6, need another 100cm box
        return { boxes60: 0, boxes80: 0, boxes100: boxes100Needed + 1 };
      }
    }
  }, [items, spaceInfo.totalSmallEquivalent]);

  const selectedPref = prefectures.find(p => p.name === selectedPrefecture);

  const shippingOptions = useMemo(() => {
    if (!selectedPref || items.length === 0) return [];

    const zone = selectedPref.zone as 1 | 2 | 3 | 4;
    const carriers: CarrierName[] = ['yuubin', 'yamato', 'sagawa'];
    
    return carriers.map(carrier => {
      let totalCost = 0;
      
      if (calculateBoxes.boxes60 > 0) {
        totalCost += shippingRates[carrier]['60'][zone] * calculateBoxes.boxes60;
      }
      if (calculateBoxes.boxes80 > 0) {
        totalCost += shippingRates[carrier]['80'][zone] * calculateBoxes.boxes80;
      }
      if (calculateBoxes.boxes100 > 0) {
        totalCost += shippingRates[carrier]['100'][zone] * calculateBoxes.boxes100;
      }

      return {
        carrier,
        ...carrierInfo[carrier],
        cost: totalCost,
        estimatedDays: zone === 1 ? '1-2' : zone === 2 ? '2-3' : zone === 3 ? '3-4' : '4-5'
      };
    }).sort((a, b) => a.cost - b.cost);
  }, [selectedPref, items, calculateBoxes]);

  const selectedShippingOption = selectedCarrier 
    ? shippingOptions.find(opt => opt.carrier === selectedCarrier)
    : shippingOptions[0];

  return (
    <div className="bg-card rounded-2xl shadow-card p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full gradient-caramel flex items-center justify-center">
          <Calculator className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Calcular Frete</h2>
          <p className="text-sm text-muted-foreground">De Mie para todo o Japão</p>
        </div>
      </div>

      {/* Prefecture Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          Selecione sua prefeitura (都道府県)
        </label>
        <select
          value={selectedPrefecture}
          onChange={(e) => setSelectedPrefecture(e.target.value)}
          className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        >
          <option value="">Escolha uma prefeitura...</option>
          {prefectures.map((pref) => (
            <option key={pref.name} value={pref.name}>
              {pref.nameJa} ({pref.name})
            </option>
          ))}
        </select>
      </div>

      {/* Cart Summary */}
      {items.length > 0 && (
        <div className="bg-secondary/50 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Seu pedido
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Potes pequenos (280g):</span>
              <span className="font-medium">{spaceInfo.small}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Potes grandes (800g):</span>
              <span className="font-medium">{spaceInfo.large}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caixas 60cm (até 2 grandes):</span>
                <span className="font-medium">{calculateBoxes.boxes60}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caixas 80cm (até 3 grandes):</span>
                <span className="font-medium">{calculateBoxes.boxes80}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caixas 100cm (até 6 grandes):</span>
                <span className="font-medium">{calculateBoxes.boxes100}</span>
              </div>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between text-foreground font-semibold">
                <span>Subtotal produtos:</span>
                <span>¥{totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Results */}
      {selectedPrefecture && items.length > 0 && shippingOptions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Escolha a transportadora para {selectedPref?.nameJa}
          </h3>
          
          <RadioGroup value={selectedCarrier || shippingOptions[0].carrier} onValueChange={(value) => setSelectedCarrier(value as CarrierName)}>
            {shippingOptions.map((option, index) => (
              <div 
                key={option.carrier}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all cursor-pointer",
                  selectedCarrier === option.carrier || (!selectedCarrier && index === 0)
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value={option.carrier} id={option.carrier} />
                  <div className="flex-1">
                    <Label htmlFor={option.carrier} className="cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{option.logo}</span>
                          <div>
                            <p className="font-medium text-foreground">{option.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {option.estimatedDays} dias úteis
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-xl font-bold text-primary">
                            ¥{option.cost.toLocaleString()}
                          </p>
                          {index === 0 && !selectedCarrier && (
                            <span className="text-xs text-primary font-medium">Mais barato</span>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(option.website, '_blank');
                        }}
                      >
                        Acessar site da transportadora <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>

          {/* Delivery Time Selection */}
          {selectedShippingOption && (
            <div className="mt-4 p-4 bg-secondary/30 rounded-xl">
              <h4 className="font-medium text-foreground flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Horário de entrega preferido
              </h4>
              <RadioGroup value={selectedDeliveryTime} onValueChange={setSelectedDeliveryTime}>
                <div className="space-y-2">
                  {selectedShippingOption.deliveryTimes.map((time) => (
                    <div key={time} className="flex items-center space-x-2">
                      <RadioGroupItem value={time} id={`time-${time}`} />
                      <Label htmlFor={`time-${time}`} className="cursor-pointer text-sm">
                        {time}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Total */}
          <div className="bg-accent text-accent-foreground rounded-xl p-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total com frete:</span>
              <span className="font-display text-2xl font-bold">
                ¥{(totalPrice + (selectedShippingOption?.cost || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Adicione produtos ao carrinho para calcular o frete</p>
        </div>
      )}
    </div>
  );
};

export default ShippingCalculator;
