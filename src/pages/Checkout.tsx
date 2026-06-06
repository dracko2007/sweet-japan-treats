import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ArrowRight, MapPin, User, Phone, Mail, Clock, Tag, CreditCard } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import CouponSelector, { computeCouponDiscount } from '@/components/checkout/CouponSelector';
import { prefectures } from '@/data/prefectures';
import { japanPrefectures } from '@/data/japanPrefectures';
import { europePrefectures } from '@/data/europePrefectures';
import { Coupon } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { usePostalCodeLookup } from '@/hooks/usePostalCodeLookup';
import { useLanguage, CountryType } from '@/context/LanguageContext';
import { formatPrice } from '@/utils/currency';
import { effectiveYen } from '@/utils/pricing';
import { convertYen as fxConvert } from '@/services/fxService';
import { productEnglishName } from '@/utils/productName';
import { isValidEmail, isValidCPF, isValidPhone, isNonEmpty, maskPhone, runValidations, FieldErrors } from '@/utils/validation';
import DemoBanner from '@/components/DemoBanner';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const Checkout: React.FC = () => {
  const { items, totalPrice } = useCart();
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { lookupAddress: lookupJapaneseAddress } = usePostalCodeLookup();
  const { selectedCountry, setSelectedCountry, t } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    postalCode: '',
    prefecture: '', // UF or Province
    city: '',
    address: '',
    building: '',
    country: selectedCountry,
  });

  // Calculate base total price dynamically in correct currency
  const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country);
  const currency = formData.country === 'Japão' ? 'JPY' : (isEuro ? 'EUR' : 'BRL');

  const baseTotalPrice = items.reduce(
    (sum, item) => sum + fxConvert(effectiveYen(item.product, item.size), currency) * item.quantity, 0
  );

  const [selectedShipping, setSelectedShipping] = useState<{
    carrier: string;
    cost: number;
    estimatedDays: string;
  } | null>(null);

  const [deliveryTime, setDeliveryTime] = useState<string>('');

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  // Erros de validação do formulário
  const [errors, setErrors] = useState<FieldErrors>({});

  // Sync country in state with language context selectedCountry
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      country: selectedCountry
    }));
  }, [selectedCountry]);

  // Sync back to selectedCountry context if form country select changes
  useEffect(() => {
    if (formData.country !== selectedCountry) {
      setSelectedCountry(formData.country as 'Brasil' | 'Japão');
    }
  }, [formData.country, selectedCountry, setSelectedCountry]);

  // Aplica um cupom do perfil (já validado pelo CouponSelector)
  const handleCouponApply = (coupon: Coupon, discount: number) => {
    setAppliedCoupon(coupon);
    setCouponDiscount(discount);

    if (coupon.freeShipping && selectedShipping) {
      setSelectedShipping({
        ...selectedShipping,
        cost: 0,
        carrier: selectedShipping.carrier + ' (Frete Grátis)',
      });
    }
  };

  const handleCouponRemove = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  // Load from state if returning from order-review page
  useEffect(() => {
    if (location.state?.formData) {
      setFormData(location.state.formData);
    }
  }, [location.state]);

  // Pré-aplica o cupom escolhido no carrinho (uma única vez)
  const cartCouponApplied = useRef(false);
  useEffect(() => {
    const cartCoupon = location.state?.coupon as Coupon | undefined;
    if (!cartCouponApplied.current && cartCoupon && baseTotalPrice > 0) {
      cartCouponApplied.current = true;
      setAppliedCoupon(cartCoupon);
      setCouponDiscount(computeCouponDiscount(cartCoupon, baseTotalPrice));
    }
  }, [location.state, baseTotalPrice]);

  // Auto-populate from user profile if authenticated
  useEffect(() => {
    if (isAuthenticated && user && !location.state?.formData) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        cpf: '', 
        postalCode: user.address?.postalCode || '',
        prefecture: user.address?.prefecture || '',
        city: user.address?.city || '',
        address: user.address?.address || '',
        building: user.address?.building || '',
        country: selectedCountry,
      });
    }
  }, [isAuthenticated, user, location.state, selectedCountry]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/carrinho');
    }
  }, [items.length, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' ? maskPhone(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Auto address lookup by CEP/Postal Code
  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    if (formData.country === 'Japão') {
      const cleanVal = val.replace(/[-\s]/g, '').slice(0, 7);
      let formatted = cleanVal;
      if (cleanVal.length > 3) {
        formatted = `${cleanVal.slice(0, 3)}-${cleanVal.slice(3, 7)}`;
      }
      setFormData(prev => ({ ...prev, postalCode: formatted }));

      if (cleanVal.length === 7) {
        try {
          const result = await lookupJapaneseAddress(cleanVal);
          if (result) {
            // Map the Japanese province name (e.g. "三重県") to the Portuguese identifier (e.g. "Mie")
            const matchedPref = japanPrefectures.find(p => p.nameJa === result.province);
            setFormData(prev => ({
              ...prev,
              prefecture: matchedPref ? matchedPref.name : '',
              city: result.city,
              address: result.town,
            }));
            toast({
              title: "Código Postal Encontrado!",
              description: `${result.province} ${result.city} ${result.town}`,
            });
          } else {
            toast({
              title: "Erro no Código Postal",
              description: "Não foi possível localizar este endereço japonês.",
              variant: "destructive",
            });
          }
        } catch (error) {
          devError('Erro ao buscar CEP japonês:', error);
        }
      }
    } else if (formData.country === 'Brasil') {
      const cleanVal = val.replace(/\D/g, '').slice(0, 8);
      let formatted = cleanVal;
      if (cleanVal.length > 5) {
        formatted = `${cleanVal.slice(0, 5)}-${cleanVal.slice(5, 8)}`;
      }
      setFormData(prev => ({ ...prev, postalCode: formatted }));

      if (cleanVal.length === 8) {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanVal}/json/`);
          const data = await response.json();
          
          if (response.ok && !data.erro) {
            const stateCode = data.uf || '';
            const addressString = data.logradouro ? `${data.logradouro}${data.bairro ? `, Bairro: ${data.bairro}` : ''}` : '';
            
            setFormData(prev => ({
              ...prev,
              prefecture: stateCode,
              city: data.localidade || '',
              address: addressString,
            }));
            
            toast({
              title: "CEP Encontrado!",
              description: `${data.localidade} - ${stateCode}`,
            });
          } else {
            toast({
              title: "Erro no CEP",
              description: "Não foi possível localizar este CEP.",
              variant: "destructive",
            });
          }
        } catch (error) {
          devError('Erro ao buscar CEP:', error);
        }
      }
    } else {
      // European countries - free form format (e.g. 0000-000 for PT, 00000 for others)
      setFormData(prev => ({ ...prev, postalCode: val }));
    }
  };

  // CPF Input formatting
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = val;
    if (val.length > 9) {
      formatted = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9, 11)}`;
    } else if (val.length > 6) {
      formatted = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}`;
    } else if (val.length > 3) {
      formatted = `${val.slice(0, 3)}.${val.slice(3, 6)}`;
    }
    setFormData(prev => ({ ...prev, cpf: formatted }));
    if (errors.cpf) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.cpf;
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Valida os campos do formulário
    const fieldErrors = runValidations({
      name: () => (isNonEmpty(formData.name, 2) ? null : 'Informe o nome completo.'),
      email: () => (isValidEmail(formData.email) ? null : 'E-mail inválido.'),
      phone: () => (isValidPhone(formData.phone) ? null : 'Telefone inválido.'),
      cpf: () =>
        formData.country === 'Brasil'
          ? isValidCPF(formData.cpf)
            ? null
            : 'CPF inválido (verifique os dígitos).'
          : null,
      postalCode: () => (isNonEmpty(formData.postalCode, 4) ? null : 'Informe o código postal.'),
      prefecture: () => (isNonEmpty(formData.prefecture) ? null : 'Selecione o estado/província.'),
      city: () => (isNonEmpty(formData.city) ? null : 'Informe a cidade.'),
      address: () => (isNonEmpty(formData.address, 3) ? null : 'Informe a rua e número.'),
    });
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      toast({
        title: 'Confira os campos destacados',
        description: 'Alguns dados precisam de correção antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedShipping) {
      toast({
        title: "Método de envio pendente",
        description: "Por favor, selecione uma forma de entrega.",
        variant: "destructive",
      });
      return;
    }

    // Navigate to order review page
    navigate('/order-review', {
      state: { 
        formData,
        shipping: selectedShipping,
        deliveryTime,
        coupon: appliedCoupon,
        couponDiscount
      } 
    });
  };

  // Apply free shipping override if coupon gives free shipping
  const actualShippingCost = appliedCoupon?.freeShipping ? 0 : (selectedShipping?.cost || 0);

  const subtotalWithCoupon = baseTotalPrice - couponDiscount;
  
  // Tax calculations (Estimated only, NOT added to grandTotal)
  let federalTax = 0;
  let icmsTax = 0;
  let estimatedTax = 0;
  let taxLabel = '';
  
  if (formData.country === 'Brasil') {
    const isBelow50USD = subtotalWithCoupon < 250;
    federalTax = isBelow50USD
      ? subtotalWithCoupon * 0.20
      : (subtotalWithCoupon * 0.60) - 62.50;
      
    icmsTax = (subtotalWithCoupon + federalTax) * 0.17;
    estimatedTax = federalTax + icmsTax;
    taxLabel = 'Impostos Estimados (Brasil)';
  } else if (isEuro) {
    const rates: Record<string, number> = { Portugal: 0.23, França: 0.20, Itália: 0.22, Espanha: 0.21 };
    const rate = rates[formData.country] || 0.20;
    estimatedTax = subtotalWithCoupon * rate;
    taxLabel = `IVA / VAT Estimado (${Math.round(rate * 100)}%)`;
  }
    
  // Taxes are completely omitted from checkout final price!
  const grandTotal = subtotalWithCoupon + actualShippingCost;

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Finalizar Pedido
            </h1>
            <p className="text-muted-foreground text-lg">
              Preencha seus dados para receber os produtos importados do Japão
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto mb-6">
            <DemoBanner />
          </div>
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-sans text-xl font-bold text-foreground">
                    Dados para Entrega
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Informações Pessoais
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="flex items-center gap-2 font-semibold">
                          <User className="w-4 h-4 text-gray-500" />
                          Nome Completo *
                        </Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          placeholder="Ex: João Silva"
                          value={formData.name}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.name}
                          className={errors.name ? 'border-destructive' : ''}
                          required
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2 font-semibold">
                          <Phone className="w-4 h-4 text-gray-500" />
                          Telefone Celular *
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="Ex: 090-1234-5678"
                          value={formData.phone}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.phone}
                          className={errors.phone ? 'border-destructive' : ''}
                          maxLength={13}
                          required
                        />
                        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2 font-semibold">
                          <Mail className="w-4 h-4 text-gray-500" />
                          Email *
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="exemplo@email.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.email}
                          className={errors.email ? 'border-destructive' : ''}
                          required
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>

                    {formData.country === 'Brasil' && (
                      <div className="space-y-2">
                        <Label htmlFor="cpf" className="flex items-center gap-2 font-semibold">
                          <User className="w-4 h-4 text-gray-500" />
                          CPF (Obrigatório Aduana) *
                        </Label>
                        <Input
                          id="cpf"
                          name="cpf"
                          type="text"
                          placeholder="000.000.000-00"
                          value={formData.cpf}
                          onChange={handleCpfChange}
                          aria-invalid={!!errors.cpf}
                          className={errors.cpf ? 'border-destructive' : ''}
                          required
                        />
                        {errors.cpf ? (
                          <p className="text-xs text-destructive">{errors.cpf}</p>
                        ) : (
                          <p className="text-[10px] text-gray-400">
                            Exigido pela Receita Federal para desembaraço de importação.
                          </p>
                        )}
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Endereço de Entrega
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country" className="font-semibold">
                          País de Destino *
                        </Label>
                        <select
                          id="country"
                          name="country"
                          value={formData.country}
                          onChange={(e) => {
                            const val = e.target.value as CountryType;
                            setFormData(prev => ({
                              ...prev,
                              country: val,
                              prefecture: '', // Reset
                              postalCode: '',
                              city: '',
                              address: '',
                              building: '',
                            }));
                          }}
                          required
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all font-medium text-sm"
                        >
                          <option value="Brasil">Brasil 🇧🇷 (Envio Internacional)</option>
                          <option value="Portugal">Portugal 🇵🇹 (Envio Internacional)</option>
                          <option value="França">França 🇫🇷 (Envio Internacional)</option>
                          <option value="Itália">Itália 🇮🇹 (Envio Internacional)</option>
                          <option value="Espanha">Espanha 🇪🇸 (Envio Internacional)</option>
                          <option value="Japão">Japão 🇯🇵 (Envio Local)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="postalCode" className="font-semibold">
                          {formData.country === 'Japão' ? 'Código Postal (ZIP) *' : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) ? 'Código Postal *' : 'CEP *'}
                        </Label>
                        <Input
                          id="postalCode"
                          name="postalCode"
                          type="text"
                          placeholder={formData.country === 'Japão' ? '123-4567' : formData.country === 'Portugal' ? '0000-000' : ['França', 'Itália', 'Espanha'].includes(formData.country) ? '00000' : '00000-000'}
                          value={formData.postalCode}
                          onChange={handlePostalCodeChange}
                          required
                        />
                        <p className="text-[10px] text-gray-400">
                          {formData.country === 'Japão' 
                            ? 'Preenche o endereço japonês automaticamente (7 dígitos).' 
                            : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) 
                            ? 'Digite o código postal de entrega.' 
                            : 'Preenche o endereço brasileiro automaticamente (8 dígitos).'}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prefecture" className="font-semibold">
                          {formData.country === 'Japão' ? 'Província *' : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) ? 'Região / Distrito *' : 'Estado (UF) *'}
                        </Label>
                        <select
                          id="prefecture"
                          name="prefecture"
                          value={formData.prefecture}
                          onChange={handleInputChange}
                          required
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all font-medium text-sm"
                        >
                          <option value="">
                            {formData.country === 'Japão' 
                              ? 'Escolha a Província...' 
                              : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) 
                              ? 'Escolha a Região/Distrito...' 
                              : 'Escolha seu Estado...'}
                          </option>
                          {(formData.country === 'Japão' 
                            ? japanPrefectures 
                            : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country)
                            ? europePrefectures[formData.country] || []
                            : prefectures
                          ).map((pref) => (
                            <option key={pref.name} value={pref.name}>
                              {pref.nameJa || pref.name} ({pref.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city" className="font-semibold">
                          Cidade *
                        </Label>
                        <Input
                          id="city"
                          name="city"
                          type="text"
                          placeholder="Ex: São Paulo"
                          value={formData.city}
                          onChange={handleInputChange}
                          aria-invalid={!!errors.city}
                          className={errors.city ? 'border-destructive' : ''}
                          required
                        />
                        {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="font-semibold">
                        Rua e Número *
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        type="text"
                        placeholder="Ex: Avenida Paulista, 1000"
                        value={formData.address}
                        onChange={handleInputChange}
                        aria-invalid={!!errors.address}
                        className={errors.address ? 'border-destructive' : ''}
                        required
                      />
                      {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="building" className="font-semibold">
                        Complemento / Bloco / Apto (Opcional)
                      </Label>
                      <Input
                        id="building"
                        name="building"
                        type="text"
                        placeholder="Ex: Bloco B, Apto 42"
                        value={formData.building}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Shipping Calculator Section */}
                  <div className="pt-4 border-t border-border">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">
                      Forma de Envio Internacional
                    </h3>
                    <ShippingCalculator 
                      selectedPrefecture={formData.prefecture}
                      onShippingSelect={setSelectedShipping}
                      destinationCountry={formData.country as CountryType}
                      couponDiscount={couponDiscount}
                    />
                  </div>

                  {/* Delivery Time Selection */}
                  {selectedShipping && (
                    <div className="pt-4 border-t border-border">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        Período de Entrega Preferido (Correios)
                      </h3>
                      <select
                        id="deliveryTime"
                        name="deliveryTime"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all font-medium text-sm"
                      >
                        <option value="">Qualquer horário (Recomendado)</option>
                        <option value="morning">Horário Comercial (9h - 18h)</option>
                        <option value="saturday">Finais de Semana</option>
                      </select>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <Button 
                      type="submit" 
                      className="w-full btn-primary rounded-xl py-6 text-lg font-bold"
                      disabled={!selectedShipping}
                    >
                      Ir para a Revisão do Pedido
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    {!selectedShipping && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Selecione uma forma de entrega para continuar
                      </p>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-card rounded-2xl border border-border p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-sans text-lg font-bold text-foreground">
                    Resumo do Pedido
                  </h2>
                </div>

                <div className="space-y-4">
                  {items.map((item) => {
                    const currency = formData.country === 'Japão' ? 'JPY' : (isEuro ? 'EUR' : 'BRL');
                    const displayUnitPrice = fxConvert(effectiveYen(item.product, item.size), currency);
                    const displayItemPrice = displayUnitPrice * item.quantity;
                    const productName = productEnglishName(item.product);
                    return (
                      <div 
                        key={`${item.product.id}-${item.size}`}
                        className="flex items-center gap-3 pb-3 border-b border-border"
                      >
                        <img 
                          src={item.product.image} 
                          alt={productName}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-gray-800 truncate">{productName}</p>
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                            {item.variantLabel || (item.size === 'small' ? 'Pequeno' : 'Grande')} • {item.quantity}x
                          </p>
                        </div>
                        <p className="font-bold text-xs text-gray-800">
                          {formatPrice(displayItemPrice, currency)}
                        </p>
                      </div>
                    );
                  })}

                  {/* Coupon Selector Widget */}
                  <CouponSelector
                    totalPrice={baseTotalPrice}
                    onCouponApply={handleCouponApply}
                    onCouponRemove={handleCouponRemove}
                    appliedCoupon={appliedCoupon}
                  />

                  {/* Calculations breakdown */}
                  <div className="space-y-2 pt-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal dos itens</span>
                      <span className="font-semibold text-gray-800">{formatPrice(baseTotalPrice, currency)}</span>
                    </div>
                    
                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="flex justify-between text-green-600 font-bold bg-green-50/50 p-1.5 rounded border border-dashed border-green-200">
                        <span>Desconto ({appliedCoupon.code})</span>
                        <span>-{formatPrice(couponDiscount, currency)}</span>
                      </div>
                    )}

                    {/* Tax displays only as estimated warnings in sidebar */}
                    {formData.country !== 'Japão' && estimatedTax > 0 && (
                      <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/60 rounded-xl p-3 space-y-2 mt-2">
                        <div className="flex justify-between text-xs font-bold text-orange-850 dark:text-orange-300">
                          <span>{taxLabel}</span>
                          <span>{formatPrice(estimatedTax, currency)}</span>
                        </div>
                        <p className="text-[10px] text-orange-700 dark:text-orange-400 leading-relaxed font-semibold">
                          ⚠️ <strong>Lembrete:</strong> Este imposto é estimado e poderá ser cobrado pela alfândega na chegada ao país. Ele <strong>NÃO</strong> está incluído no total cobrado no site.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {formData.country === 'Japão' ? 'Frete Local' : 'Frete Internacional'}
                      </span>
                      {selectedShipping ? (
                        <span className="font-semibold text-gray-800">
                          {actualShippingCost === 0 ? 'Grátis' : formatPrice(actualShippingCost, currency)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">
                          {formData.country === 'Japão' ? 'Aguardando Província' : 'Aguardando Estado'}
                        </span>
                      )}
                    </div>

                    {selectedShipping && (
                      <div className="text-[10px] text-gray-400 text-right">
                        {selectedShipping.carrier} • {selectedShipping.estimatedDays} dias
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-border font-bold">
                      <span className="text-sm">Total a pagar</span>
                      <span className="text-base text-orange-600">
                        {formatPrice(grandTotal, currency)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold">
                    <CreditCard className="w-4 h-4 text-amber-600" /> Ambiente de demonstração
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Checkout;
