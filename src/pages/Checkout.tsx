import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ArrowRight, MapPin, User, Phone, Mail, Clock } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { prefectures } from '@/data/prefectures';
import { addAddressHints } from '@/utils/romanize';

const Checkout: React.FC = () => {
  const { items, totalPrice } = useCart();
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    postalCode: '',
    prefecture: '',
    city: '',
    address: '',
    building: '',
  });

  const [selectedShipping, setSelectedShipping] = useState<{
    carrier: string;
    cost: number;
    estimatedDays: string;
  } | null>(null);

  const [deliveryTime, setDeliveryTime] = useState<string>('');

  // Load form data from state if returning from review page
  useEffect(() => {
    if (location.state?.formData) {
      setFormData(location.state.formData);
    }
  }, [location.state]);

  // Auto-populate from user profile if authenticated
  useEffect(() => {
    if (isAuthenticated && user && !location.state?.formData) {
      console.log('🔍 Checkout - Preenchendo dados do usuário:', user);
      console.log('📍 Endereço do usuário:', user.address);
      console.log('🏛️ Província do usuário:', user.address?.prefecture);
      
      const formDataToSet = {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        postalCode: user.address?.postalCode || '',
        prefecture: user.address?.prefecture || '',
        city: user.address?.city || '',
        address: user.address?.address || '',
        building: user.address?.building || '',
      };
      
      console.log('📝 Dados que serão preenchidos no formulário:', formDataToSet);
      
      setFormData(formDataToSet);
      
      console.log('✅ Checkout - Formulário preenchido com dados do perfil');
    } else if (!isAuthenticated) {
      console.log('⚠️ Checkout - Usuário não autenticado');
    } else if (!user) {
      console.log('⚠️ Checkout - Dados do usuário não disponíveis');
    } else if (location.state?.formData) {
      console.log('🔄 Checkout - Usando dados do location.state (voltando da revisão)');
    }
  }, [isAuthenticated, user, location.state]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/carrinho');
    }
  }, [items.length, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Busca automática de endereço por CEP
  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    
    // Formata CEP (XXX-XXXX)
    let formatted = value;
    if (value.length > 3) {
      formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}`;
    }
    
    setFormData(prev => ({ ...prev, postalCode: formatted }));

    // Busca endereço quando CEP está completo (7 dígitos)
    if (value.length === 7) {
      try {
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${value}`);
        const data = await response.json();
        
        if (data.status === 200 && data.results && data.results.length > 0) {
          const result = data.results[0];
          const prefecture = prefectures.find(p => p.nameJa === result.address1);
          const prefectureDisplay = prefecture 
            ? `${result.address1} (${prefecture.name})` 
            : result.address1;
          
          // Adiciona hints de leitura para cidade e bairro separadamente
          const city = addAddressHints(result.address2);
          const neighborhood = result.address3 ? addAddressHints(result.address3) : '';
          const cityDisplay = neighborhood ? `${city} ${neighborhood}` : city;
          
          setFormData(prev => ({
            ...prev,
            prefecture: prefectureDisplay,
            city: cityDisplay,
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate shipping is selected
    if (!selectedShipping) {
      return; // ShippingCalculator will handle the UI feedback
    }

    // Navigate to review page with form data and shipping info
    navigate('/order-review', { 
      state: { 
        formData,
        shipping: selectedShipping,
        deliveryTime
      } 
    });
  };

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Finalizar Pedido
            </h1>
            <p className="text-muted-foreground text-lg">
              Preencha seus dados para receber os produtos
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    Dados para Entrega
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Informações Pessoais
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Nome Completo *
                        </Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          placeholder="山田 太郎"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Telefone *
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="090-1234-5678"
                          value={formData.phone}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email *
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="exemplo@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Endereço de Entrega
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">
                          CEP (〒) *
                        </Label>
                        <Input
                          id="postalCode"
                          name="postalCode"
                          type="text"
                          placeholder="123-4567"
                          value={formData.postalCode}
                          onChange={handlePostalCodeChange}
                          maxLength={8}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Digite o CEP - Província e cidade preenchem automaticamente
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prefecture">
                          Prefeitura (都道府県) *
                        </Label>
                        <select
                          id="prefecture"
                          name="prefecture"
                          value={formData.prefecture}
                          onChange={handleInputChange}
                          required
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">
                        Cidade (市区町村) *
                      </Label>
                      <Input
                        id="city"
                        name="city"
                        type="text"
                        placeholder="津市"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">
                        Endereço (町名番地) *
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        type="text"
                        placeholder="広明町123-45"
                        value={formData.address}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="building">
                        Edifício / Apartamento (任意)
                      </Label>
                      <Input
                        id="building"
                        name="building"
                        type="text"
                        placeholder="マンション名 101号室"
                        value={formData.building}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Shipping Calculator Section */}
                  <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                      Calcular Frete
                    </h3>
                    <ShippingCalculator 
                      selectedPrefecture={formData.prefecture}
                      onShippingSelect={setSelectedShipping}
                    />
                  </div>

                  {/* Delivery Time Selection */}
                  {selectedShipping && (
                    <div className="pt-4 border-t border-border">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Horário de Entrega Preferido
                      </h3>
                      <select
                        id="deliveryTime"
                        name="deliveryTime"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Qualquer horário</option>
                        <option value="morning">Manhã (9:00 - 12:00)</option>
                        <option value="afternoon">Tarde (12:00 - 17:00)</option>
                        <option value="evening">Noite (17:00 - 20:00)</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Faremos o possível para entregar no horário preferido
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <Button 
                      type="submit" 
                      className="w-full btn-primary rounded-xl py-6 text-lg font-semibold"
                      disabled={!selectedShipping}
                    >
                      Revisar Pedido
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    {!selectedShipping && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Selecione uma transportadora para continuar
                      </p>
                    )}
                  </div>
                </form>
              </div>

              {/* Shipping Calculator - Full Width on Mobile */}
              <div className="lg:col-span-2 lg:hidden">
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Calcular Frete
                  </h3>
                  <ShippingCalculator 
                    selectedPrefecture={formData.prefecture}
                    onShippingSelect={setSelectedShipping}
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Resumo do Pedido
                  </h2>
                </div>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div 
                      key={`${item.product.id}-${item.size}`}
                      className="flex items-center gap-3 pb-3 border-b border-border"
                    >
                      <img 
                        src={item.product.image} 
                        alt={item.product.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size} • {item.quantity}x
                        </p>
                      </div>
                      <p className="font-semibold text-sm">
                        ¥{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">¥{totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      {selectedShipping ? (
                        <span className="font-medium">¥{selectedShipping.cost.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Selecione acima</span>
                      )}
                    </div>
                    {selectedShipping && (
                      <div className="text-xs text-muted-foreground text-right">
                        {selectedShipping.carrier} - {selectedShipping.estimatedDays} dias
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-lg text-primary">
                        ¥{selectedShipping 
                          ? (totalPrice + selectedShipping.cost).toLocaleString()
                          : `${totalPrice.toLocaleString()}+`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      Pagamento seguro via PIX, cartão ou transferência
                    </p>
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
