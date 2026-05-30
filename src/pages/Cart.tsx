import { safeStorage } from '@/utils/storage';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Trash2, Tag, ShieldCheck, HelpCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CartItemComponent from '@/components/cart/CartItem';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice } from '@/utils/currency';

const Cart: React.FC = () => {
  const { items, clearCart } = useCart();
  const { t, selectedCountry, setSelectedCountry } = useLanguage();

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState('');

  // Enforce country destination if Japan-only items are in cart
  const hasJapanOnlyItems = items.some(item => item.product.deliveryRestrict === 'Japão');

  useEffect(() => {
    if (hasJapanOnlyItems && selectedCountry !== 'Japão') {
      setSelectedCountry('Japão');
    }
  }, [hasJapanOnlyItems, selectedCountry, setSelectedCountry]);

  // Check for Wheel of Fortune coupon in safeStorage on load
  useEffect(() => {
    const savedCoupon = safeStorage.getItem('sakura_active_coupon');
    if (savedCoupon === 'SAKURA90') {
      setActiveCoupon({ code: 'SAKURA90', discountPercent: 90 });
    }
  }, []);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');

    const formattedCode = couponCode.trim().toUpperCase();
    if (formattedCode === 'SAKURA90') {
      setActiveCoupon({ code: 'SAKURA90', discountPercent: 90 });
      safeStorage.setItem('sakura_active_coupon', 'SAKURA90');
      setCouponCode('');
    } else if (formattedCode === 'BEMVINDO10') {
      setActiveCoupon({ code: 'BEMVINDO10', discountPercent: 10 });
      safeStorage.setItem('sakura_active_coupon', 'BEMVINDO10');
      setCouponCode('');
    } else if (formattedCode !== '') {
      setCouponError('Cupom inválido ou expirado.');
    }
  };

  const handleRemoveCoupon = () => {
    setActiveCoupon(null);
    safeStorage.removeItem('sakura_active_coupon');
  };

  // Calculations in correct currency
  const currency = selectedCountry === 'Japão' ? 'JPY' : 'BRL';
  
  const baseTotalPrice = items.reduce((sum, item) => {
    const price = item.size === 'small' ? item.product.prices.small : item.product.prices.large;
    let unitPrice = price;
    if (selectedCountry === 'Japão') {
      if (item.product.deliveryRestrict !== 'Japão') {
        unitPrice = price * 28; // Convert BRL to JPY
      }
    }
    return sum + unitPrice * item.quantity;
  }, 0);

  const discountPercent = activeCoupon ? activeCoupon.discountPercent : 0;
  const discountAmount = baseTotalPrice * (discountPercent / 100);
  const subtotalWithDiscount = baseTotalPrice - discountAmount;
  
  // Tax calculations
  let federalTax = 0;
  let icmsTax = 0;
  let grandTotal = subtotalWithDiscount;

  if (selectedCountry === 'Brasil') {
    // New Brazilian Tax rules (post-August 2024):
    // Up to $50 USD (approx. R$ 250): 20% Federal Tax + 17% ICMS
    // Above $50 USD: 60% Federal Tax (with R$ 62.50 deduction) + 17% ICMS
    const isBelow50USD = subtotalWithDiscount < 250;
    
    federalTax = isBelow50USD
      ? subtotalWithDiscount * 0.20
      : (subtotalWithDiscount * 0.60) - 62.50;
      
    icmsTax = (subtotalWithDiscount + federalTax) * 0.17;
    grandTotal = subtotalWithDiscount + federalTax + icmsTax;
  }

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {selectedCountry === 'Japão' ? 'Carrinho de Compras (Japão 🇯🇵)' : 'Carrinho de Compras (Internacional 🇧🇷)'}
            </h1>
            <p className="text-muted-foreground text-lg">
              {items.length > 0 
                ? `Você tem ${items.length} ${items.length === 1 ? 'item' : 'itens'} no carrinho`
                : 'Seu carrinho está vazio'
              }
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          {items.length > 0 ? (
            <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
              {/* Cart Items List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-sans text-xl font-bold text-foreground">
                    Seus Produtos
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearCart}
                    className="text-muted-foreground hover:text-destructive font-semibold"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar carrinho
                  </Button>
                </div>

                {/* Japan-only Restriction Warning Banner */}
                {hasJapanOnlyItems && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="font-sans font-bold text-sm text-amber-800">
                        Entrega Exclusiva no Japão
                      </h4>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        O seu carrinho contém produtos de <strong>Doce de Leite Sabor do Campo</strong>. Estes produtos são fabricados artesanalmente e enviados apenas localmente dentro do Japão. Por este motivo, o destino de envio foi definido e fixado como Japão.
                      </p>
                    </div>
                  </div>
                )}

                {items.map((item) => (
                  <CartItemComponent 
                    key={`${item.product.id}-${item.size}`} 
                    item={item} 
                  />
                ))}

                {/* Remessa Conforme Trust Badge Info Banner for Brazil */}
                {selectedCountry === 'Brasil' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 mt-6">
                    <ShieldCheck className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-sans font-bold text-sm text-orange-800 flex items-center gap-1.5">
                        Alíquota do Remessa Conforme Atualizada (2026)
                      </h4>
                      <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                        {subtotalWithDiscount < 250 ? (
                          <span>
                            <strong>Taxação de 20% + ICMS inclusa:</strong> Conforme a nova legislação brasileira, compras internacionais de até <strong>R$ 250,00</strong> pagam 20% de Imposto de Importação Federal + 17% de ICMS Estadual. Todos os impostos já estão calculados no carrinho para evitar surpresas na alfândega dos Correios.
                          </span>
                        ) : (
                          <span>
                            <strong>Atenção:</strong> Seu pedido ultrapassou R$ 250,00. Para compras acima de R$ 250, aplica-se a alíquota de <strong>60% de Imposto de Importação Federal</strong> (com abatimento de R$ 62,50) + 17% de ICMS. Considere dividir o seu pedido em dois carrinhos separados de até R$ 250 cada para aproveitar a alíquota reduzida de 20%!
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Japan Local Shipping Banner */}
                {selectedCountry === 'Japão' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 mt-6">
                    <span className="text-xl">📦</span>
                    <div>
                      <h4 className="font-sans font-bold text-sm text-emerald-800">
                        Envio Nacional Seguro (Japan Post / Yamato / Sagawa)
                      </h4>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        Seu pedido será embalado e despachado diretamente de nossa cozinha em Mie. O frete será calculado na próxima etapa com base no tamanho das caixas e na província selecionada.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary Card */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-2xl border border-border p-6 sticky top-24 space-y-6 shadow-sm">
                  <h3 className="font-sans text-lg font-bold text-foreground">Resumo do Pedido</h3>
                  
                  {/* Coupon Application Input */}
                  <form onSubmit={handleApplyCoupon} className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Cupom de Desconto
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: SAKURA90"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background uppercase font-bold"
                      />
                      <Button type="submit" variant="secondary" className="px-4 text-xs font-bold">
                        Aplicar
                      </Button>
                    </div>
                    {couponError && <p className="text-xs text-red-500 font-semibold">{couponError}</p>}
                  </form>

                  {/* Price Summary List */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal dos itens</span>
                      <span className="font-semibold text-gray-800">{formatPrice(baseTotalPrice, currency)}</span>
                    </div>

                    {activeCoupon && (
                      <div className="flex justify-between text-sm text-green-600 font-bold bg-green-50/50 p-2 rounded-lg border border-dashed border-green-200">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 shrink-0" /> Cupom ({activeCoupon.code})
                        </span>
                        <span className="flex items-center gap-1">
                          -{activeCoupon.discountPercent}% (-{formatPrice(discountAmount, currency)})
                          <button 
                            onClick={handleRemoveCoupon}
                            className="text-red-500 hover:text-red-700 ml-1 text-xs"
                            title="Remover cupom"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    )}

                    {/* Tax displays only for Brazil */}
                    {selectedCountry === 'Brasil' && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            Imposto Federal ({subtotalWithDiscount < 250 ? '20%' : '60%'})
                            <span title={subtotalWithDiscount < 250 ? "Imposto federal de 20% para compras abaixo de US$ 50" : "Imposto federal de 60% para compras acima de US$ 50 (deduzido R$ 62,50)"}>
                              <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                            </span>
                          </span>
                          <span className="font-semibold text-gray-800">{formatPrice(federalTax, 'BRL')}</span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            ICMS Estadual (17%)
                            <span title="Imposto estadual aplicado sobre o valor aduaneiro">
                              <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                            </span>
                          </span>
                          <span className="font-semibold text-gray-800">{formatPrice(icmsTax, 'BRL')}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="text-xs text-muted-foreground">Calcular no checkout</span>
                    </div>

                    <div className="flex justify-between pt-3 border-t border-border">
                      <span className="font-black text-lg text-gray-800">Total Geral</span>
                      <div className="text-right">
                        <span className="font-black text-2xl text-orange-600">
                          {formatPrice(grandTotal, currency)}
                        </span>
                        {selectedCountry === 'Brasil' ? (
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">ou até 12x no cartão</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Pague via PayPay ou Depósito</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button asChild className="w-full btn-primary rounded-xl py-6 text-lg font-bold">
                    <Link to="/checkout">
                      Finalizar Compra
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  
                  <p className="text-center text-xs text-muted-foreground">
                    {selectedCountry === 'Japão' 
                      ? '🏠 Cozinha artesanal em Mie - Frete rápido e seguro.'
                      : '✈️ Despachado de Tóquio com entrega expressa pelos Correios.'
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 rounded-full bg-secondary mx-auto mb-6 flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-muted-foreground" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Seu carrinho está vazio
              </h2>
              <p className="text-muted-foreground mb-8">
                Adicione alguns produtos incríveis ao seu carrinho!
              </p>
              <Button asChild className="btn-primary rounded-full px-8">
                <Link to="/produtos">
                  Ver Produtos
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>
      </Layout>
  );
};

export default Cart;
