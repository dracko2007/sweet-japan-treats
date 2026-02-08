import React, { useState, useEffect } from 'react';
import { Tag, X, Check, Gift, Truck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { couponService } from '@/services/couponService';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import type { Coupon } from '@/types';
import { cn } from '@/lib/utils';

interface CouponSelectorProps {
  totalPrice: number;
  onCouponApply: (coupon: Coupon, discount: number) => void;
  onCouponRemove: () => void;
  appliedCoupon: Coupon | null;
}

const CouponSelector: React.FC<CouponSelectorProps> = ({
  totalPrice,
  onCouponApply,
  onCouponRemove,
  appliedCoupon,
}) => {
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [showCoupons, setShowCoupons] = useState(false);
  const { user, orders } = useUser();
  const { toast } = useToast();

  // Reload coupons when user changes or when returning from order
  useEffect(() => {
    loadAvailableCoupons();
  }, [user, appliedCoupon]);

  const loadAvailableCoupons = async () => {
    // Load latest coupons from Firestore first (so client sees admin-created ones)
    const active = await couponService.getActiveAsync();
    const userEmail = user?.email || '';
    const userBirthdate = user?.birthdate || '';
    const userTotalOrders = orders?.length || 0;
    
    // Filter coupons: check targeting, then usage
    const filtered: typeof active = [];
    for (const coupon of active) {
      // Check targeting eligibility first
      if (!couponService.checkTargetEligibility(coupon, userEmail, userBirthdate, userTotalOrders)) {
        continue;
      }
      
      // Check localStorage first (fast)
      const usedBy = couponService.getCouponUsage(coupon.code);
      if (usedBy.includes(userEmail)) continue;
      
      // Check Firestore too (persistent)
      if (userEmail) {
        const asyncResult = await couponService.validateCouponAsync(coupon.code, userEmail);
        if (!asyncResult.valid) continue;
      }
      
      filtered.push(coupon);
    }

    setAvailableCoupons(filtered);
  };

  const handleSelectCoupon = (coupon: Coupon) => {
    const discount = couponService.calculateDiscount(coupon, totalPrice);
    onCouponApply(coupon, discount);
    setShowCoupons(false);
    toast({
      title: "Cupom aplicado!",
      description: `Desconto de ¥${discount.toLocaleString()} aplicado`,
    });
  };

  const handleRemoveCoupon = () => {
    onCouponRemove();
    toast({
      title: "Cupom removido",
      description: "O desconto foi removido",
    });
  };

  return (
    <div className="pt-4 mt-4 border-t border-border">
      {!appliedCoupon ? (
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Tag className="w-4 h-4" />
            Cupom de Desconto
          </Label>

          {availableCoupons.length > 0 ? (
            <>
              <Button
                type="button"
                onClick={() => setShowCoupons(!showCoupons)}
                variant="outline"
                className="w-full"
              >
                {showCoupons ? 'Ocultar cupons' : 'Ver cupons disponíveis'}
              </Button>

              {showCoupons && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableCoupons.map((coupon) => {
                    const discount = couponService.calculateDiscount(coupon, totalPrice);
                    const discountText = coupon.type === 'fixed' 
                      ? `¥${coupon.discount.toLocaleString()}` 
                      : `${coupon.discountPercent}%`;

                    return (
                      <button
                        key={coupon.code}
                        type="button"
                        onClick={() => handleSelectCoupon(coupon)}
                        className="w-full p-3 rounded-lg border-2 border-border hover:border-primary transition-all text-left"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-primary">{coupon.code}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                {coupon.freeShipping ? '🚚 Frete Grátis' : `-${discountText}`}
                              </span>
                              {coupon.targetType === 'birthday' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 flex items-center gap-1">
                                  <Gift className="w-3 h-3" /> Aniversário
                                </span>
                              )}
                              {coupon.targetType === 'loyalty' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                                  <Star className="w-3 h-3" /> Fidelidade
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {coupon.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Válido até {new Date(coupon.expiryDate).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-sm font-bold text-green-600 dark:text-green-400">
                              -¥{discount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum cupom disponível no momento
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
