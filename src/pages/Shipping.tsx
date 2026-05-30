import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, Clock, Shield, ArrowRight, HelpCircle, Info, Landmark, Percent, Calculator, Weight, Box } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { Button } from '@/components/ui/button';
import { useLanguage, CountryType } from '@/context/LanguageContext';
import { formatPrice } from '@/utils/currency';

const Shipping: React.FC = () => {
  const { t, selectedCountry } = useLanguage();
  const [country, setCountry] = useState<CountryType>(selectedCountry);

  // Simulator state (typed string inputs for smooth deletion and no spinner jumping)
  const [simValueInput, setSimValueInput] = useState<string>('150');
  const [simHeightInput, setSimHeightInput] = useState<string>('20');
  const [simWidthInput, setSimWidthInput] = useState<string>('20');
  const [simDepthInput, setSimDepthInput] = useState<string>('20');
  const [simWeightInput, setSimWeightInput] = useState<string>('1.5');

  // Sync with global country context selection
  useEffect(() => {
    setCountry(selectedCountry);
  }, [selectedCountry]);

  // Adjust simulator defaults when country changes to avoid mismatched currencies
  useEffect(() => {
    if (country === 'Japão') {
      setSimValueInput('4500'); // 4500 JPY
    } else if (['Portugal', 'França', 'Itália', 'Espanha'].includes(country)) {
      setSimValueInput('25'); // 25 EUR
    } else {
      setSimValueInput('150'); // 150 BRL
    }
  }, [country]);

  // Parse inputs to numbers for calculations
  const simValue = parseFloat(simValueInput) || 0;
  const simHeight = parseFloat(simHeightInput) || 0;
  const simWidth = parseFloat(simWidthInput) || 0;
  const simDepth = parseFloat(simDepthInput) || 0;
  const simWeight = parseFloat(simWeightInput) || 0;

  // Calculations for dynamic simulator
  const simVolume = (simHeight * simWidth * simDepth) / 1000000; // Volume in m³
  const volumetricWeight = simVolume * 200; // Volumetric constant: 1m3 = 200kg (standards)
  const billableWeight = Math.max(simWeight, volumetricWeight);
  const dimensionSum = simHeight + simWidth + simDepth;

  // Weight limits based on standard box size category (sum of dimensions H+W+D)
  const getWeightLimit = (dimSum: number): number => {
    if (dimSum <= 60) return 2; // Caixa 60 -> Max 2kg
    if (dimSum <= 80) return 5; // Caixa 80 -> Max 5kg
    if (dimSum <= 100) return 10; // Caixa 100 -> Max 10kg
    if (dimSum <= 120) return 15; // Caixa 120 -> Max 15kg
    return 30; // Max 30kg for international courier packages
  };

  const maxAllowedWeight = getWeightLimit(dimensionSum);
  const isWeightExceeded = simWeight > maxAllowedWeight;

  const setBoxPreset = (h: number, w: number, d: number) => {
    setSimHeightInput(h.toString());
    setSimWidthInput(w.toString());
    setSimDepthInput(d.toString());
  };

  const getSimulatorRates = () => {
    if (country === 'Japão') {
      return [
        { name: 'Japan Post Local 📮', cost: 700 + 150 * billableWeight, time: '1-2 dias' },
        { name: 'Yamato Transport 🐱', cost: 800 + 180 * billableWeight, time: '1-2 dias' },
        { name: 'Sagawa Express 🏃‍♂️', cost: 750 + 160 * billableWeight, time: '1-2 dias' }
      ];
    }
    if (['Portugal', 'França', 'Itália', 'Espanha'].includes(country)) {
      return [
        { name: 'Local Post (CTT/La Poste) ✉️', cost: 20 + 6 * billableWeight, time: '7-10 dias' },
        { name: 'Yamato EMS Aéreo ✈️', cost: 35 + 10 * billableWeight, time: '5-8 dias' },
        { name: 'Sagawa Priority Express ⚡', cost: 55 + 15 * billableWeight, time: '3-6 dias' },
        { name: 'Encomenda Marítima (Navio) 🚢', cost: 12 + 3 * billableWeight, time: '50-70 dias' }
      ];
    }
    // Brasil
    return [
      { name: 'Correios PAC Padrão 📦', cost: 120 + 35 * billableWeight, time: '10-15 dias' },
      { name: 'Yamato EMS Aéreo ✈️', cost: 220 + 60 * billableWeight, time: '7-12 dias' },
      { name: 'Sagawa Priority Courier ⚡', cost: 350 + 85 * billableWeight, time: '5-8 dias' },
      { name: 'Encomenda Marítima (Navio) 🚢', cost: 65 + 15 * billableWeight, time: '60-80 dias' }
    ];
  };

  const getSimulatorTax = () => {
    if (country === 'Brasil') {
      // Brasil: 20% federal + 17% ICMS for < R$250, 60% federal + 17% ICMS for >= R$250
      const isBelow50USD = simValue < 250;
      const federal = isBelow50USD ? simValue * 0.20 : (simValue * 0.60) - 62.50;
      const icms = (simValue + federal) * 0.17;
      return {
        total: Math.max(0, federal + icms),
        label: isBelow50USD ? 'Federal (20%) + ICMS (17%)' : 'Federal (60%) + ICMS (17%)'
      };
    }
    
    const vatRates: Record<string, { rate: number; label: string }> = {
      Portugal: { rate: 0.23, label: 'IVA Portugal (23%)' },
      França: { rate: 0.20, label: 'TVA França (20%)' },
      Itália: { rate: 0.22, label: 'IVA Itália (22%)' },
      Espanha: { rate: 0.21, label: 'IVA Espanha (21%)' }
    };

    if (vatRates[country]) {
      return {
        total: simValue * vatRates[country].rate,
        label: vatRates[country].label
      };
    }

    return { total: 0, label: 'Isento' };
  };

  const simRates = getSimulatorRates();
  const simTax = getSimulatorTax();

  // Sample rates data based on files (for Zone 1 / Major Cities as reference)
  const getSampleRates = () => {
    if (country === 'Japão') {
      return [
        {
          name: 'Japan Post Local (ゆうパック) ✉️',
          logo: '📮',
          desc: 'Envio econômico via correio japonês.',
          rate60: 870,
          rate80: 1100,
          time: '1-2 dias úteis',
          features: ['Rastreamento completo', 'Entrega aos sábados/domingos', 'Seguro básico']
        },
        {
          name: 'Yamato Transport (宅急便) 🐱',
          logo: '📦',
          desc: 'Entrega expressa líder no Japão.',
          rate60: 930,
          rate80: 1150,
          time: '1-2 dias úteis',
          features: ['Horários selecionáveis', 'Entrega rápida', 'Alta confiabilidade']
        },
        {
          name: 'Sagawa Express (飛脚宅配便) 🏃‍♂️',
          logo: '🏃‍♂️',
          desc: 'Serviço corporativo e privado rápido.',
          rate60: 880,
          rate80: 1100,
          time: '1-2 dias úteis',
          features: ['Rastreável online', 'Suporte local excelente', 'Rede expressa']
        }
      ];
    }

    if (['Portugal', 'França', 'Itália', 'Espanha'].includes(country)) {
      const localPostNames: Record<string, string> = {
        Portugal: 'Correios CTT Padrão 🇵🇹',
        França: 'La Poste Padrão 🇫🇷',
        Itália: 'Poste Italiane Padrão 🇮🇹',
        Espanha: 'Correos España Padrão 🇪🇸'
      };
      
      const localPostName = localPostNames[country] || 'Correios Internacional Padrão ✉️';

      return [
        {
          name: localPostName,
          logo: '✉️',
          desc: 'Parceria com o correio estatal do país de destino.',
          rate60: 159.90 * 0.16,
          rate80: 349.90 * 0.16,
          time: '7-10 dias úteis',
          features: ['Entrega domiciliar', 'Rastreio nos correios locais', 'Entrega segura']
        },
        {
          name: 'Aéreo Expresso EMS (Tóquio-Europa) ✈️',
          logo: '✈️',
          desc: 'Voo direto expresso com prioridade máxima.',
          rate60: 299.90 * 0.16,
          rate80: 599.90 * 0.16,
          time: '5-8 dias úteis',
          features: ['Despacho prioritário Narita', 'Rastreio em tempo real', 'Trânsito aéreo expresso']
        },
        {
          name: 'Priority Express Courier (DHL/FedEx) 🏃‍♂️',
          logo: '⚡',
          desc: 'Transportadora expressa internacional privada.',
          rate60: 449.90 * 0.16,
          rate80: 799.90 * 0.16,
          time: '3-6 dias úteis',
          features: ['Desembaraço super rápido', 'Entrega porta a porta', 'Garantia de prazo']
        },
        {
          name: 'Encomenda Marítima / Navio 🚢',
          logo: '🚢',
          desc: 'Opção mais econômica e lenta, via marítima.',
          rate60: 79.90 * 0.16,
          rate80: 179.90 * 0.16,
          time: '50-70 dias úteis',
          features: ['Custo baixíssimo', 'Ideal para envios pesados', 'Seguro simples']
        }
      ];
    }

    // Default: Brasil
    return [
      {
        name: 'Correios PAC Padrão',
        logo: '📦',
        desc: 'Opção mais econômica com entrega no Brasil todo.',
        rate60: 139.90,
        rate80: 329.90,
        time: '10-15 dias úteis',
        features: ['Seguro incluso', 'Rastreio nos Correios', 'Entrega nacional']
      },
      {
        name: 'Aéreo Expresso EMS (Tóquio-Brasil)',
        logo: '✈️',
        desc: 'Voo direto expresso com trâmite prioritário.',
        rate60: 279.90,
        rate80: 559.90,
        time: '7-12 dias úteis',
        features: ['Prioridade na aduana', 'Rastreio internacional', 'Despacho rápido']
      },
      {
        name: 'Priority Courier Internacional',
        logo: '⚡',
        desc: 'Serviço Courier expresso privado (DHL/FedEx).',
        rate60: 419.90,
        rate80: 769.90,
        time: '5-8 dias úteis',
        features: ['Coleta no mesmo dia', 'Aduana ultra veloz', 'Entrega agendada']
      },
      {
        name: 'Encomenda Marítima / Navio 🚢',
        logo: '🚢',
        desc: 'Envio de baixo custo via navio cargueiro.',
        rate60: 79.90,
        rate80: 179.90,
        time: '60-80 dias úteis',
        features: ['Mais econômico', 'Rastreio em alto mar', 'Entrega final Correios']
      }
    ];
  };

  const sampleRates = getSampleRates();
  const currency = country === 'Japão' ? 'JPY' : (['Portugal', 'França', 'Itália', 'Espanha'].includes(country) ? 'EUR' : 'BRL');

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Políticas de Envio e Prazos
            </h1>
            <p className="text-muted-foreground text-lg">
              Veja as taxas de envio aéreo, prazos estimados e detalhes fiscais para cada país
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          
          {/* Country Selection Dropdown */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Simular Destino de Envio
              </h3>
              <p className="text-xs text-muted-foreground">
                Selecione o país de destino para visualizar as transportadoras disponíveis, taxas de frete e regras de tributação.
              </p>
            </div>
            <div className="min-w-[240px]">
              <select
                id="country-selector"
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryType)}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground font-semibold focus:ring-2 focus:ring-primary transition-all text-sm cursor-pointer"
              >
                <option value="Brasil">Brasil 🇧🇷</option>
                <option value="Portugal">Portugal 🇵🇹</option>
                <option value="França">França 🇫🇷</option>
                <option value="Itália">Itália 🇮🇹</option>
                <option value="Espanha">Espanha 🇪🇸</option>
                <option value="Japão">Japão 🇯🇵</option>
              </select>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 items-start">
            
            {/* Left Column: Interactive Shipping Calculator & Advanced Simulator */}
            <div className="lg:col-span-3 space-y-8">
              
              {/* Box Shipping Calculator */}
              <ShippingCalculator destinationCountry={country} />
              
              {/* Advanced Interactive Simulator Widget */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-sans text-lg font-bold text-foreground">
                      Simulador de Envio por Peso & Dimensões
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Simule pacotes sob medida informando o valor declarado, as dimensões da caixa e o peso físico.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Row 1: Declared Value & Weight */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                        Valor Decl. ({currency})
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={simValueInput}
                        onChange={(e) => setSimValueInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Weight className="w-3.5 h-3.5 text-primary" /> Peso Físico (kg)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={simWeightInput}
                        onChange={(e) => setSimWeightInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-semibold"
                      />
                    </div>
                  </div>

                  {/* Row 2: Box Dimensions in cm */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Box className="w-3.5 h-3.5 text-primary" /> Dimensões da Caixa (cm)
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Altura</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={simHeightInput}
                          onChange={(e) => setSimHeightInput(e.target.value.replace(/[^0-9.]/g, ''))}
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-semibold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Largura</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={simWidthInput}
                          onChange={(e) => setSimWidthInput(e.target.value.replace(/[^0-9.]/g, ''))}
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-semibold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Profundidade</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={simDepthInput}
                          onChange={(e) => setSimDepthInput(e.target.value.replace(/[^0-9.]/g, ''))}
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-semibold text-center"
                        />
                      </div>
                    </div>

                    {/* Presets and linear sum */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBoxPreset(20, 20, 20)}
                          className="text-[9px] bg-secondary hover:bg-secondary/80 px-2 py-1 rounded text-muted-foreground hover:text-foreground font-semibold"
                        >
                          Caixa 60 (20x20x20)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoxPreset(30, 25, 25)}
                          className="text-[9px] bg-secondary hover:bg-secondary/80 px-2 py-1 rounded text-muted-foreground hover:text-foreground font-semibold"
                        >
                          Caixa 80 (30x25x25)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoxPreset(40, 30, 30)}
                          className="text-[9px] bg-secondary hover:bg-secondary/80 px-2 py-1 rounded text-muted-foreground hover:text-foreground font-semibold"
                        >
                          Caixa 100 (40x30x30)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weight limit warning */}
                {isWeightExceeded && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl p-4 text-xs text-red-800 dark:text-red-300 font-semibold space-y-1">
                    <p className="flex items-center gap-1.5 font-bold text-red-600">
                      ⚠️ Peso Excedido para esta Caixa
                    </p>
                    <p className="leading-relaxed">
                      O peso máximo permitido para uma caixa de dimensões somando <strong>{dimensionSum} cm</strong> é de <strong>{maxAllowedWeight} kg</strong>. 
                      O peso atual informado é de <strong>{simWeight} kg</strong>. Por favor, aumente o tamanho da caixa ou diminua o peso físico dos produtos para simular o frete.
                    </p>
                  </div>
                )}

                {/* Calculation Info */}
                <div className="bg-secondary/40 p-3.5 rounded-xl border border-border/80 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex justify-between">
                    <span>Soma das Dimensões (Altura + Largura + Prof.):</span>
                    <span className="font-bold text-foreground">{dimensionSum} cm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume Resultante:</span>
                    <span className="font-semibold text-foreground">{simVolume.toFixed(6)} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Peso Cubado (Volumétrico):</span>
                    <span className="font-semibold text-foreground">{volumetricWeight.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5 mt-1 font-bold">
                    <span className="text-foreground">Peso Taxável (Maior entre Físico e Cubado):</span>
                    <span className="text-primary">{billableWeight.toFixed(2)} kg</span>
                  </div>
                </div>

                {/* Simulator Results */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Custo do Frete Estimado</h4>
                  {isWeightExceeded ? (
                    <div className="p-6 bg-red-50/20 rounded-xl border border-dashed border-red-200 text-center text-xs text-red-700 dark:text-red-400 font-semibold">
                      🚫 Cálculo suspenso. Corrija o peso físico ou aumente as dimensões da caixa.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {simRates.map((rate) => (
                        <div key={rate.name} className="p-3 bg-secondary/20 rounded-xl border border-border text-center flex flex-col justify-between">
                          <span className="text-[10px] text-muted-foreground block truncate font-bold">{rate.name}</span>
                          <span className="text-base font-black text-primary block mt-1">{formatPrice(rate.cost, currency)}</span>
                          <span className="text-[9px] text-muted-foreground block mt-0.5">Prazo: {rate.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Simulated Tax Result */}
                {country !== 'Japão' && simTax.total > 0 && (
                  <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm font-bold text-orange-850 dark:text-orange-300">
                      <span className="flex items-center gap-1.5">
                        <Percent className="w-4 h-4" />
                        Imposto Alfandegário Estimado ({simTax.label})
                      </span>
                      <span>{formatPrice(simTax.total, currency)}</span>
                    </div>
                    <p className="text-[10px] text-orange-700 dark:text-orange-400 leading-relaxed font-semibold">
                      ⚠️ <strong>Nota Fiscal:</strong> Este imposto é apenas uma estimativa aproximada cobrada pelas autoridades fiscais na alfândega do país de destino. Ele <strong>NÃO</strong> é adicionado ao checkout da SakuraExpress e deve ser pago na chegada caso o pacote seja tributado.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-secondary/50 rounded-xl border border-border flex items-start gap-3">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>Dica de Economia Sakura:</strong> Adicione mais itens para preencher totalmente o espaço da caixa (60cm ou 80cm) e diluir o custo unitário do frete aéreo internacional por item!
                  </p>
                  <Button asChild variant="link" className="mt-1.5 p-0 h-auto text-primary text-xs font-bold">
                    <Link to="/produtos" className="flex items-center gap-1">
                      Ver Catálogo de Produtos
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Rates & Taxes */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Dynamic Impostos (Taxes) Card */}
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2 border-b border-primary/10 pb-3">
                  <Percent className="w-5 h-5 text-primary animate-pulse" />
                  Regras Alfandegárias ({country})
                </h3>
                
                {country === 'Brasil' && (
                  <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg p-3 text-orange-850 dark:text-orange-200 font-medium">
                      ⚠️ <strong>Remessa Conforme: Impostos Estimados</strong>
                    </div>
                    <p>
                      Diferente de compras nacionais, as compras internacionais de importação a partir do Japão sofrem taxação na alfândega de Curitiba. Apresentamos as estimativas no carrinho para sua transparência.
                    </p>
                    <p className="text-orange-700 dark:text-orange-400 font-semibold bg-orange-50/50 p-2 rounded">
                      * O valor do imposto é apenas informativo e não será acrescido ao valor final pago no site. O imposto é pago na chegada do pacote caso cobrado pela alfândega.
                    </p>
                    <div className="border-t border-primary/10 pt-2.5 space-y-2">
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Compras até R$ 250 (US$ 50):</span>
                        <span className="text-orange-600">20% Federal + 17% ICMS</span>
                      </div>
                      <p className="text-[10px] pl-2 border-l-2 border-border">
                        Cobrança simplificada de 20% sobre o valor aduaneiro e 17% de ICMS Estadual incidindo por dentro.
                      </p>
                      
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Compras acima de R$ 250:</span>
                        <span className="text-orange-600">60% Federal + 17% ICMS</span>
                      </div>
                      <p className="text-[10px] pl-2 border-l-2 border-border">
                        Aplica-se alíquota de 60% de imposto de importação federal (com dedução fixa de R$ 62,50) + 17% de ICMS Estadual.
                      </p>
                    </div>
                  </div>
                )}

                {['Portugal', 'França', 'Itália', 'Espanha'].includes(country) && (
                  <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg p-3 text-blue-800 dark:text-blue-200 font-medium">
                      ℹ️ <strong>Importação Aérea Europeia (DDU/DAP)</strong>
                    </div>
                    <p>
                      Não cobramos taxas ou impostos europeus de importação (como IVA/VAT ou tarifas alfandegárias locais) no fechamento do seu pedido no site. O pacote é enviado do Japão via remessa postal internacional simples.
                    </p>
                    <div className="border-t border-primary/10 pt-2.5 space-y-2">
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Imposto no Checkout:</span>
                        <span className="text-green-600">€ 0,00</span>
                      </div>
                      <p className="text-[10px] pl-2 border-l-2 border-border">
                        Você paga apenas o valor dos produtos e o frete de Tóquio no nosso site.
                      </p>
                      
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Tributação na Alfândega Local:</span>
                        <span className="text-blue-600">IVA + Taxas Postais</span>
                      </div>
                      <p className="text-[10px] pl-2 border-l-2 border-border">
                        Na chegada à alfândega europeia, o pacote poderá estar sujeito à cobrança do IVA local do país de destino (ex: 23% em Portugal, 20% na França) e tarifas aduaneiras postais locais (como a taxa dos CTT ou La Poste) a serem pagas pelo destinatário.
                      </p>
                    </div>
                  </div>
                )}

                {country === 'Japão' && (
                  <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg p-3 text-emerald-800 dark:text-emerald-200 font-medium">
                      ✓ <strong>Envio Nacional Local (Isento de Taxas de Importação)</strong>
                    </div>
                    <p>
                      Como o envio é doméstico (despachado de nossa cozinha em Mie), não há nenhum trâmite alfandegário ou cobrança de impostos de importação internacional.
                    </p>
                    <div className="border-t border-primary/10 pt-2.5 space-y-2">
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Imposto de Importação:</span>
                        <span className="text-green-600">Isento (¥0)</span>
                      </div>
                      
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Imposto de Consumo Local (Shouhizei):</span>
                        <span className="text-emerald-600">Incluso (10%)</span>
                      </div>
                      <p className="text-[10px] pl-2 border-l-2 border-border">
                        O imposto de consumo japonês de 10% já está totalmente incluído no preço de tabela dos produtos.
                      </p>
                      
                      <div className="flex justify-between font-bold text-foreground">
                        <span>Benefício de Frete Grátis:</span>
                        <span className="text-emerald-600">Disponível</span>
                      </div>
                      <p className="text-[10px] pl-2 border-l-2 border-border">
                        Seu frete local no Japão é 100% gratuito para compras acima de ¥6.000 na Sakura Express!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Carrier & Box Table */}
              <div className="space-y-4">
                <h3 className="font-display text-lg font-bold text-foreground">
                  Tarifas Médias de Amostra ({country})
                </h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  *Valores médios fixados como referência de custo médio para caixas padrão (Zone 1/Principais Cidades). O simulador à esquerda calcula com base no peso e dimensão real digitados.
                </p>
                <div className="space-y-3">
                  {sampleRates.map((carrier) => (
                    <div key={carrier.name} className="p-4 rounded-xl bg-card border border-border space-y-3 hover:border-primary/50 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{carrier.logo}</span>
                          <div>
                            <h4 className="font-bold text-sm text-foreground leading-snug">{carrier.name}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{carrier.desc}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border/80 text-xs">
                        <div className="bg-secondary/40 p-2 rounded-lg text-center">
                          <span className="text-muted-foreground block text-[10px]">Média Caixa 60cm</span>
                          <span className="font-sans font-black text-sm text-primary">
                            {formatPrice(carrier.rate60, currency)}
                          </span>
                        </div>
                        <div className="bg-secondary/40 p-2 rounded-lg text-center">
                          <span className="text-muted-foreground block text-[10px]">Média Caixa 80cm</span>
                          <span className="font-sans font-black text-sm text-primary">
                            {formatPrice(carrier.rate80, currency)}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        Prazo estimado: <span className="font-semibold text-foreground">{carrier.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>
    </Layout>
  );
};

export default Shipping;
