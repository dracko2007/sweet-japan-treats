import React, { useState } from 'react';
import { Tag, X, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useUser, Coupon } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/utils/currency';
import { getMoneyRates } from '@/services/fxService';
import { couponTerms, discountYenToDisplay } from '../../../shared/money.js';

interface CouponSelectorProps {
  /** Subtotal elegível ao cupom, na moeda do cliente. */
  totalPrice: number;
  /** Moeda do cliente (BRL/EUR/USD/JPY). */
  currency?: string;
  onCouponApply: (coupon: Coupon, discount: number) => void;
  onCouponRemove: () => void;
  appliedCoupon: Coupon | null;
}

/**
 * Prévia do desconto de um cupom do perfil, na moeda do cliente. Mesma regra
 * do servidor (`shared/money.js`): cupom fixo é em IENES — antes o valor em ¥
 * era descontado como se fosse R$/€/$ (cupom de ¥500 virava R$ 500).
 * O valor que vale é o do resumo do checkout, que usa `displayTotals`.
 */
export const computeCouponDiscount = (coupon: Coupon, subtotal: number, currency = 'JPY'): number => {
  const terms = couponTerms(coupon);
  if (!terms || terms.freeShipping || !(subtotal > 0)) return 0;
  if (terms.fixed) return Math.min(subtotal, discountYenToDisplay(terms.fixedYen, currency, getMoneyRates()));
  return Math.min(subtotal, Math.round(subtotal * terms.percent / 100));
};

const CouponSelector: React.FC<CouponSelectorProps> = ({
  totalPrice,
  currency = 'JPY',
  onCouponApply,
  onCouponRemove,
  appliedCoupon,
}) => {
  const { coupons, isAuthenticated } = useUser();
  const { toast } = useToast();
  const [showCoupons, setShowCoupons] = useState(false);

  // Apenas os cupons do PERFIL que estão válidos (não usados, não expirados)
  const now = new Date();
  const availableCoupons = coupons.filter(
    (c) => !c.isUsed && new Date(c.expiresAt) > now
  );

  const handleSelectCoupon = (coupon: Coupon) => {
    const discount = computeCouponDiscount(coupon, totalPrice, currency);
    onCouponApply(coupon, discount);
    setShowCoupons(false);
    toast({
      title: 'Cupom aplicado!',
      description: coupon.freeShipping
        ? 'Frete grátis aplicado'
        : `Desconto de ${formatPrice(discount, currency, true)} aplicado`,
    });
  };

  const handleRemoveCoupon = () => {
    onCouponRemove();
    toast({ title: 'Cupom removido', description: 'O desconto foi removido' });
  };

  return (
    <div className="pt-4 mt-4 border-t border-border">
      {!appliedCoupon ? (
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Tag className="w-4 h-4" />
            Meus Cupons
          </Label>

          {!isAuthenticated ? (
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para ver e usar seus cupons.
            </p>
          ) : availableCoupons.length > 0 ? (
            <>
              <Button
                type="button"
                onClick={() => setShowCoupons(!showCoupons)}
                variant="outline"
                className="w-full"
              >
                {showCoupons ? 'Ocultar cupons' : `Ver meus cupons (${availableCoupons.length})`}
              </Button>

              {showCoupons && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableCoupons.map((coupon) => {
                    const discount = computeCouponDiscount(coupon, totalPrice, currency);
                    const discountText = coupon.freeShipping
                      ? 'Frete Grátis'
                      : coupon.discountType === 'fixed'
                      ? `¥${coupon.discount.toLocaleString()}`
                      : `${coupon.discount}%`;

                    return (
                      <button
                        key={coupon.id}
                        type="button"
                        onClick={() => handleSelectCoupon(coupon)}
                        className="w-full p-3 rounded-lg border-2 border-border hover:border-primary transition-all text-left"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-primary">{coupon.code}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center gap-1">
                                {coupon.freeShipping && <Truck className="w-3 h-3" />}
                                {coupon.freeShipping ? 'Frete Grátis' : `-${discountText}`}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">{coupon.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Válido até {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          {!coupon.freeShipping && (
                            <div className="text-right ml-2">
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                -{formatPrice(discount, currency, true)}
                              </p>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Você não tem cupons disponíveis no momento.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {appliedCoupon.code}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {appliedCoupon.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
            >
              <X className="w-4 h-4 text-green-700 dark:text-green-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponSelector;
