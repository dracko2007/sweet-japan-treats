import { safeStorage } from '@/utils/storage';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ArrowRight, Printer, CreditCard, Landmark, Smartphone, MapPin, User, Phone, Mail, CheckCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice } from '@/utils/currency';
import { effectiveYen } from '@/utils/pricing';
import { pointsForSpendYen, POINTS } from '@/services/pointsService';
import { getTranslatedProductName } from '@/data/translations';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { paymentSettingsService } from '@/services/paymentSettingsService';
import { Wallet } from 'lucide-react';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const OrderReview: React.FC = () => {
  const { items, clearCart } = useCart();
  const { consumeCouponByCode, user, addPoints } = useUser();
  const [pointsToUse, setPointsToUse] = useState<number>(() => {
    const v = Number(safeStorage.getItem('redeem_points'));
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const formData = location.state?.formData;
  const shipping = location.state?.shipping;
  const couponDiscount = location.state?.couponDiscount || 0;
  const appliedCoupon = location.state?.coupon;

  const [paymentMethod, setPaymentMethod] = useState(() => {
    return formData?.country === 'Japão' ? 'paypay' : 'pix';
  });
  const [wiseEnabled, setWiseEnabled] = useState(false);

  useEffect(() => {
    paymentSettingsService.get().then((s) => setWiseEnabled(s.wiseEnabled && !!s.wiseLink));
  }, []);

  // Redirect if no form data or shipping
  useEffect(() => {
    if (!formData || !shipping) {
      navigate('/checkout');
    }
  }, [formData, shipping, navigate]);

  if (!formData || !shipping) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  const isJapan = formData.country === 'Japão';
  const isEurope = ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country);
  const currency = isJapan ? 'JPY' : (isEurope ? 'EUR' : 'BRL');

  const convertYen = (yen: number) => isJapan ? yen : isEurope ? (yen / 28) * 0.16 : yen / 28;

  // Subtotal dos produtos em ¥ (já com desconto promocional, sem frete) — base dos pontos
  const productSubtotalYen = items.reduce(
    (sum, item) => sum + effectiveYen(item.product, item.size) * item.quantity, 0
  );

  // Base Total Price (subtotal before discounts/taxes) in target currency
  const baseTotalPrice = items.reduce(
    (sum, item) => sum + convertYen(effectiveYen(item.product, item.size)) * item.quantity, 0
  );

  // Resgate de pontos (1 ponto = ¥1). Não pode passar do valor dos produtos.
  const availablePoints = user?.points || 0;
  const maxRedeemable = Math.min(availablePoints, Math.floor(productSubtotalYen / POINTS.yenPerPoint));
  const redeemPoints = Math.max(0, Math.min(pointsToUse, maxRedeemable));
  const pointsDiscount = convertYen(redeemPoints * POINTS.yenPerPoint); // desconto na moeda exibida
  // Pontos ganhos pelo gasto em produtos (descontando o que foi pago com pontos)
  const earnedPoints = pointsForSpendYen(Math.max(0, productSubtotalYen - redeemPoints * POINTS.yenPerPoint));

  // PIX gets 5% additional discount (Temu high conversion strategy) - ONLY for Brazil
  const isPix = paymentMethod === 'pix';
  const subtotalWithCoupon = Math.max(0, baseTotalPrice - couponDiscount - pointsDiscount);
  const pixDiscount = (formData.country === 'Brasil' && isPix) ? subtotalWithCoupon * 0.05 : 0;
  const priceAfterPix = subtotalWithCoupon - pixDiscount;
  
  // Taxes (Estimated only, NOT added to grand total)
  let federalTax = 0;
  let icmsTax = 0;
  let estimatedTax = 0;
  let taxLabel = '';
  
  if (formData.country === 'Brasil') {
    const isBelow50USD = priceAfterPix < 250;
    federalTax = isBelow50USD
      ? priceAfterPix * 0.20
      : (priceAfterPix * 0.60) - 62.50;
      
    icmsTax = (priceAfterPix + federalTax) * 0.17;
    estimatedTax = federalTax + icmsTax;
    taxLabel = 'Impostos Estimados (Brasil)';
  } else if (isEurope) {
    const rates: Record<string, number> = { Portugal: 0.23, França: 0.20, Itália: 0.22, Espanha: 0.21 };
    const rate = rates[formData.country] || 0.20;
    estimatedTax = priceAfterPix * rate;
    taxLabel = `IVA / VAT Estimado (${Math.round(rate * 100)}%)`;
  }
  
  const taxAmount = estimatedTax; // Saved in mockOrder for administrative visibility
  
  const finalShippingCost = appliedCoupon?.freeShipping ? 0 : shipping.cost;
  // Grand Total only includes products + shipping (NO TAXES ADDED!)
  const grandTotal = priceAfterPix + finalShippingCost;

  const handleConfirmOrder = () => {
    toast({
      title: "Processando Pedido...",
      description: isJapan ? "Preparando seu pedido com o centro de Hiroshima." : `Preparando seus dados com a aduana ${formData.country === 'Brasil' ? 'do Brasil' : 'de destino'}.`,
    });

    const countryPrefix = isJapan ? 'JP' : formData.country === 'Brasil' ? 'BR' : formData.country === 'Portugal' ? 'PT' : formData.country === 'França' ? 'FR' : formData.country === 'Itália' ? 'IT' : 'ES';

    const orderId = isJapan 
      ? `SC-JP-${Math.floor(100000 + Math.random() * 900000)}`
      : `SE-${countryPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    const trackingPrefix = isJapan ? 'JP' : countryPrefix === 'BR' ? 'NX' : 'EX';
    const trackingCode = `${trackingPrefix}${Math.floor(100000000 + Math.random() * 900000000)}JP`;

    // Save mock order to simulated db (local storage for the admin panel)
    const mockOrder = {
      id: orderId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      cpf: formData.cpf || '',
      postalCode: formData.postalCode,
      prefecture: formData.prefecture,
      city: formData.city,
      address: formData.address,
      building: formData.building,
      country: formData.country,
      shippingCarrier: shipping.carrier,
      shippingCost: finalShippingCost,
      subtotal: baseTotalPrice,
      couponCode: appliedCoupon?.code || '',
      couponDiscount: couponDiscount,
      pixDiscount: pixDiscount,
      federalTax: federalTax,
      icmsTax: icmsTax,
      taxAmount: taxAmount,
      total: grandTotal,
      currency: currency,
      paymentMethod: paymentMethod,
      status: 'Pendente',
      trackingCode: trackingCode,
      date: new Date().toLocaleDateString('pt-BR'),
      items: items.map(item => {
        const finalUnitPrice = convertYen(effectiveYen(item.product, item.size));
        return {
          id: item.product.id,
          name: getTranslatedProductName(item.product.id, t),
          image: item.product.image,
          quantity: item.quantity,
          size: item.variantLabel || (item.size === 'small' ? 'Pequeno' : 'Grande'),
          price: finalUnitPrice,
          cost: item.product.cost || 0, // custo de aquisição em ¥ (admin)
        };
      })
    };

    // Save to list of orders in safeStorage (backup local / mesmo dispositivo)
    const existingOrders = JSON.parse(safeStorage.getItem('sakura_orders') || '[]');
    safeStorage.setItem('sakura_orders', JSON.stringify([mockOrder, ...existingOrders]));

    // ⭐ GRAVA NO FIRESTORE — sem isto o pedido só fica no navegador do comprador
    // e o admin (em outro dispositivo) NUNCA vê. Formato exato que o painel espera:
    // shippingAddress aninhado, items[].productName, orderNumber, totalPrice, status 'pending'.
    const firestoreOrder = {
      orderNumber: orderId,
      id: orderId,
      customerName: formData.name,
      customerEmail: formData.email || '',
      status: 'pending',
      orderDate: new Date().toISOString(),
      date: mockOrder.date,
      totalPrice: grandTotal,
      total: grandTotal,
      totalAmount: grandTotal,
      currency,
      paymentMethod,
      trackingCode,
      couponCode: appliedCoupon?.code || '',
      couponDiscount,
      pixDiscount,
      taxAmount,
      shippingCarrier: shipping.carrier,
      shippingCost: finalShippingCost,
      shipping: { cost: finalShippingCost, carrier: shipping.carrier, estimatedDays: shipping.estimatedDays },
      affiliateCode: appliedCoupon?.affiliateCode || '',
      shippingAddress: {
        name: formData.name,
        phone: formData.phone || '',
        email: formData.email || '',
        postalCode: formData.postalCode || '',
        prefecture: formData.prefecture || '',
        city: formData.city || '',
        address: formData.address || '',
        building: formData.building || '',
        country: formData.country,
      },
      items: mockOrder.items.map((it) => ({
        productId: it.id,
        productName: it.name,
        name: it.name,
        image: it.image,
        quantity: it.quantity,
        size: it.size,
        price: it.price,
        cost: it.cost || 0,
      })),
    };

    // Fire-and-forget: não trava a confirmação para o comprador
    firebaseSyncService
      .syncOrderToFirestore(user?.id || formData.email || 'guest', firestoreOrder)
      .then((ok) => devLog(ok ? '✅ Pedido salvo no Firestore' : '⚠️ Falha ao salvar pedido no Firestore'))
      .catch((e) => devError('❌ Erro ao salvar pedido no Firestore:', e));

    // Cupom de afiliado/influencer → registra comissão PENDENTE (liberada só
    // quando o admin confirmar a entrega do pedido)
    if (appliedCoupon?.affiliateCode) {
      const netYenBase = items.reduce((sum, item) => {
        const p = effectiveYen(item.product, item.size);
        return sum + p * item.quantity;
      }, 0);
      const fraction = appliedCoupon.discountType === 'percentage' ? appliedCoupon.discount / 100 : 0;
      const netYen = Math.round(netYenBase * (1 - fraction));
      import('@/services/affiliateService').then(({ affiliateService }) => {
        affiliateService.addPendingCommission({
          affiliateCode: appliedCoupon.affiliateCode,
          netYen,
          orderId,
          buyerEmail: formData.email || '',
        });
      });
      safeStorage.removeItem('affiliate_ref');
    } else if (appliedCoupon?.code) {
      // Cupom pessoal → consome (uso único, some do perfil)
      consumeCouponByCode(appliedCoupon.code);
    }

    // 🎁 Pontos de fidelidade: deduz o resgate e credita o ganho pelo gasto.
    if (user) {
      const net = earnedPoints - redeemPoints;
      if (net !== 0) addPoints(net);
      if (redeemPoints > 0 || earnedPoints > 0) {
        toast({
          title: '🎁 Pontos atualizados',
          description: [
            redeemPoints > 0 ? `-${redeemPoints} usados como desconto` : '',
            earnedPoints > 0 ? `+${earnedPoints} ganhos nesta compra` : '',
          ].filter(Boolean).join(' · '),
        });
      }
    }

    // Clear cart upon final purchase order creation
    clearCart();
    safeStorage.removeItem('redeem_points');

    // Navigate to confirmation page
    navigate('/order-confirmation', {
      state: {
        order: mockOrder
      }
    });
  };

  return (
    <Layout>
      <div className="gradient-hero py-16 print:hidden">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Revisar Pedido
            </h1>
            <p className="text-muted-foreground text-lg">
              {isJapan 
                ? 'Verifique os dados de entrega doméstica antes de confirmar'
                : 'Verifique todos os dados da importação aérea antes de finalizar'
              }
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Print Button */}
            <div className="flex justify-end print:hidden">
              <Button onClick={handlePrint} variant="outline" className="gap-2 font-semibold">
                <Printer className="w-4 h-4" />
                Imprimir Recibo
              </Button>
            </div>

            {/* Order Items Summary */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-sans text-xl font-bold text-foreground">
                  {isJapan ? 'Produtos Selecionados (Entrega no Japão)' : 'Produtos Selecionados (Tóquio Hub)'}
                </h2>
              </div>

              <div className="space-y-4">
                {items.map((item) => {
                  const displayUnitPrice = convertYen(effectiveYen(item.product, item.size));
                  const displayItemPrice = displayUnitPrice * item.quantity;
                  const productName = getTranslatedProductName(item.product.id, t);
                  return (
                    <div 
                      key={`${item.product.id}-${item.size}`}
                      className="flex items-center gap-4 pb-4 border-b border-border last:border-0"
                    >
                      <img 
                        src={item.product.image} 
                        alt={productName}
                        className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{productName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Opção: {item.variantLabel || (item.size === 'small' ? 'Pequeno' : 'Grande')} • Quantidade: {item.quantity}x
                        </p>
                        <p className="text-xs text-gray-400">
                          Preço unitário: {formatPrice(displayUnitPrice, currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-base text-foreground">
                          {formatPrice(displayItemPrice, currency)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Calculation breakdown */}
                <div className="pt-4 space-y-2.5 text-sm border-t border-border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(baseTotalPrice, currency)}</span>
                  </div>
                  
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 font-bold bg-green-50/50 p-2 rounded border border-dashed border-green-200">
                      <span>Desconto do Cupom {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                      <span>-{formatPrice(couponDiscount, currency)}</span>
                    </div>
                  )}

                  {/* Resgate de pontos de fidelidade */}
                  {user && availablePoints > 0 && (
                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-dashed border-purple-300 rounded-lg p-3 print:hidden">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> Usar pontos ({availablePoints} disponíveis)
                        </span>
                        <span className="text-[11px] text-purple-700">1 ponto = ¥1</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} max={maxRedeemable}
                          value={pointsToUse || ''}
                          onChange={(e) => setPointsToUse(Math.max(0, Math.min(maxRedeemable, Number(e.target.value) || 0)))}
                          placeholder="0"
                          className="w-24 px-2 py-1.5 rounded-lg border border-purple-300 bg-background text-sm"
                        />
                        <button type="button" onClick={() => setPointsToUse(maxRedeemable)}
                          className="text-xs font-semibold text-purple-700 hover:underline">Usar máx. ({maxRedeemable})</button>
                        {redeemPoints > 0 && (
                          <button type="button" onClick={() => setPointsToUse(0)}
                            className="text-xs text-muted-foreground hover:underline ml-auto">limpar</button>
                        )}
                      </div>
                    </div>
                  )}

                  {pointsDiscount > 0 && (
                    <div className="flex justify-between text-purple-700 font-bold bg-purple-50/60 p-2 rounded border border-dashed border-purple-200">
                      <span>Desconto em pontos ({redeemPoints} pts)</span>
                      <span>-{formatPrice(pointsDiscount, currency)}</span>
                    </div>
                  )}

                  {pixDiscount > 0 && (
                    <div className="flex justify-between text-orange-600 font-bold bg-orange-50 p-2 rounded border border-dashed border-orange-200">
                      <span>Desconto Extra de 5% (Pagamento via PIX)</span>
                      <span>-{formatPrice(pixDiscount, 'BRL')}</span>
                    </div>
                  )}

                  {user && earnedPoints > 0 && (
                    <div className="flex justify-between text-green-700 text-xs bg-green-50/60 p-2 rounded">
                      <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Você ganhará nesta compra</span>
                      <span className="font-bold">+{earnedPoints} pts</span>
                    </div>
                  )}

                  {/* Estimated international taxes (shown only as reminder, not summed) */}
                  {formData.country !== 'Japão' && estimatedTax > 0 && (
                    <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/60 rounded-xl p-3 space-y-2 mt-2">
                      <div className="flex justify-between text-xs font-bold text-orange-850 dark:text-orange-300">
                        <span>{taxLabel}</span>
                        <span>{formatPrice(estimatedTax, currency)}</span>
                      </div>
                      <p className="text-[10px] text-orange-700 dark:text-orange-400 leading-relaxed font-semibold">
                        ⚠️ <strong>Nota:</strong> Este imposto é aproximado e poderá ser cobrado pela alfândega local na chegada do pacote no país de destino. Ele <strong>NÃO</strong> foi adicionado ao total geral cobrado no site.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between text-muted-foreground">
                    <span>{isJapan ? 'Frete Local' : 'Frete Aéreo'} ({shipping.carrier})</span>
                    <span>{finalShippingCost === 0 ? 'Grátis' : formatPrice(finalShippingCost, currency)}</span>
                  </div>

                  <div className="text-[10px] text-gray-400 text-right">
                    {isJapan ? 'Envio doméstico seguro de Hiroshima Prefecture.' : `Voo internacional Tóquio para ${formData.country}.`} Entrega estimada: {shipping.estimatedDays} dias úteis
                  </div>

                  <div className="flex justify-between pt-3 border-t border-border font-black text-lg">
                    <span>Total Geral</span>
                    <span className="text-2xl text-orange-600">
                      {formatPrice(grandTotal, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer & Customs Info */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-sans text-xl font-bold text-foreground">
                  {isJapan ? 'Informações do Cliente' : 'Informações de Faturamento e Aduana'}
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground font-semibold">Nome Completo</Label>
                  <p className="font-bold text-gray-800 text-base">{formData.name}</p>
                </div>

                 {!isJapan && (
                   <div>
                     <Label className="text-muted-foreground font-semibold">CPF (Desembaraço Aduaneiro)</Label>
                     <p className="font-bold text-orange-600 text-base">{formData.cpf}</p>
                   </div>
                 )}

                <div>
                  <Label className="text-muted-foreground font-semibold">Telefone</Label>
                  <p className="font-medium text-gray-800">{formData.phone}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground font-semibold">Email de Contato</Label>
                  <p className="font-medium text-gray-800">{formData.email}</p>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                  <h2 className="font-sans text-xl font-bold text-foreground">
                    Endereço de Entrega ({
                      formData.country === 'Japão' ? 'Japão 🇯🇵' :
                      formData.country === 'Brasil' ? 'Brasil 🇧🇷' :
                      formData.country === 'Portugal' ? 'Portugal 🇵🇹' :
                      formData.country === 'França' ? 'França 🇫🇷' :
                      formData.country === 'Itália' ? 'Itália 🇮🇹' :
                      'Espanha 🇪🇸'
                    })
                  </h2>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Código Postal / CEP</Label>
                    <p className="font-bold text-gray-800">〒 {formData.postalCode}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{isJapan ? 'Província' : 'Estado / UF'}</Label>
                    <p className="font-medium text-gray-800">{formData.prefecture}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cidade</Label>
                    <p className="font-medium text-gray-800">{formData.city}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rua e Número</Label>
                  <p className="font-medium text-gray-800">{formData.address}</p>
                </div>
                {formData.building && (
                  <div>
                    <Label className="text-muted-foreground">Complemento / Edifício</Label>
                    <p className="font-medium text-gray-800">{formData.building}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 print:hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-sans text-xl font-bold text-foreground">
                  Selecione o Método de Pagamento
                </h2>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="space-y-4">
                  {isJapan ? (
                    <>
                      {/* PayPay Option for Japan */}
                      <div className={cn(
                        "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'paypay' ? "border-orange-500 bg-orange-50/50" : "border-border hover:border-gray-300"
                      )}>
                        <RadioGroupItem value="paypay" id="paypay" className="mt-1" />
                        <Label htmlFor="paypay" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">📱</span>
                            <span className="font-bold text-base text-gray-800">PayPay</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Pague de forma rápida e instantânea usando o aplicativo PayPay via QR Code na próxima tela.
                          </p>
                        </Label>
                      </div>

                      {/* Bank Transfer Option for Japan */}
                      <div className={cn(
                        "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'yucho' ? "border-orange-500 bg-orange-50/50" : "border-border hover:border-gray-300"
                      )}>
                        <RadioGroupItem value="yucho" id="yucho" className="mt-1" />
                        <Label htmlFor="yucho" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Landmark className="w-5 h-5 text-emerald-600" />
                            <span className="font-bold text-base text-gray-800">Depósito Bancário (Yucho Bank / ゆうちょ銀行)</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Faça a transferência para nossa conta no Yucho Bank (Paula Shiokawa). As instruções estarão na próxima tela.
                          </p>
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* PIX Option */}
                      <div className={cn(
                        "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                        isPix ? "border-orange-500 bg-orange-50/50" : "border-border hover:border-gray-300"
                      )}>
                        <RadioGroupItem value="pix" id="pix" className="mt-1" />
                        <Label htmlFor="pix" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Smartphone className="w-5 h-5 text-orange-500" />
                            <span className="font-bold text-base text-gray-800">PIX de Alta Velocidade</span>
                            <span className="text-[10px] bg-orange-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">5% OFF EXTRA</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Aprovação em 3 segundos. Mostraremos o QR Code e a chave Copia e Cola na próxima página.
                          </p>
                        </Label>
                      </div>

                      {/* Credit Card Option */}
                      <div className={cn(
                        "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                        paymentMethod === 'card' ? "border-orange-500 bg-orange-50/50" : "border-border hover:border-gray-300"
                      )}>
                        <RadioGroupItem value="card" id="card" className="mt-1" />
                        <Label htmlFor="card" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="w-5 h-5 text-blue-500" />
                            <span className="font-bold text-base text-gray-800">Cartão de Crédito Nacional / Internacional</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Parcele em até 12x no cartão (Visa, MasterCard, Elo, Amex).
                          </p>
                        </Label>
                      </div>

                      {/* Wise Option (transferência internacional) */}
                      {wiseEnabled && (
                        <div className={cn(
                          "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                          paymentMethod === 'wise' ? "border-emerald-500 bg-emerald-50/50" : "border-border hover:border-gray-300"
                        )}>
                          <RadioGroupItem value="wise" id="wise" className="mt-1" />
                          <Label htmlFor="wise" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2 mb-1">
                              <Wallet className="w-5 h-5 text-emerald-600" />
                              <span className="font-bold text-base text-gray-800">Wise (Transferência Internacional)</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Pague em qualquer moeda com câmbio justo. Mostraremos o link de pagamento Wise na próxima tela.
                            </p>
                          </Label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </RadioGroup>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 print:hidden">
              <Button 
                variant="outline" 
                onClick={() => navigate('/checkout', { state: { formData } })}
                className="flex-1 rounded-xl py-6 text-lg border-2"
              >
                Voltar e Editar Dados
              </Button>
              <Button 
                onClick={handleConfirmOrder}
                className="flex-1 btn-primary rounded-xl py-6 text-lg font-bold"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirmar e Pagar {formatPrice(grandTotal, currency)}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default OrderReview;
