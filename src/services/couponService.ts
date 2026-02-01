import type { Coupon } from '@/types';

const STORAGE_KEY = 'sweet-japan-coupons';

export const couponService = {
  // Get all coupons
  getAll: (): Coupon[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  // Get active coupons
  getActive: (): Coupon[] => {
    const coupons = couponService.getAll();
    const now = new Date();
    return coupons.filter(c => 
      c.isActive && 
      new Date(c.expiryDate) > now &&
      (!c.usageLimit || c.usedCount < c.usageLimit)
    );
  },

  // Validate and get coupon by code
  validateCoupon: (code: string): { valid: boolean; coupon?: Coupon; error?: string } => {
    const coupons = couponService.getAll();
    const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());

    if (!coupon) {
      return { valid: false, error: 'Cupom inválido' };
    }

    if (!coupon.isActive) {
      return { valid: false, error: 'Cupom desativado' };
    }

    const now = new Date();
    if (new Date(coupon.expiryDate) < now) {
      return { valid: false, error: 'Cupom expirado' };
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, error: 'Cupom esgotado' };
    }

    return { valid: true, coupon };
  },

  // Calculate discount
  calculateDiscount: (coupon: Coupon, subtotal: number): number => {
    if (coupon.type === 'fixed') {
      return Math.min(coupon.discount, subtotal);
    } else {
      return Math.round(subtotal * (coupon.discountPercent || 0) / 100);
    }
  },

  // Use coupon (increment usage)
  useCoupon: (code: string): void => {
    const coupons = couponService.getAll();
    const index = coupons.findIndex(c => c.code.toUpperCase() === code.toUpperCase());
    
    if (index !== -1) {
      coupons[index].usedCount += 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
    }
  },

  // Create new coupon
  create: (coupon: Omit<Coupon, 'createdAt' | 'usedCount'>): Coupon => {
    const coupons = couponService.getAll();
    
    const newCoupon: Coupon = {
      ...coupon,
      code: coupon.code.toUpperCase(),
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };

    coupons.push(newCoupon);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
    return newCoupon;
  },

  // Update coupon
  update: (code: string, updates: Partial<Coupon>): boolean => {
    const coupons = couponService.getAll();
    const index = coupons.findIndex(c => c.code === code);
    
    if (index !== -1) {
      coupons[index] = { ...coupons[index], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
      return true;
    }
    return false;
  },

  // Delete coupon
  delete: (code: string): boolean => {
    const coupons = couponService.getAll();
    const filtered = coupons.filter(c => c.code !== code);
    
    if (filtered.length < coupons.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  },

  // Create default welcome coupon
  createDefaultCoupons: (): void => {
    const coupons = couponService.getAll();
    if (coupons.length === 0) {
      // Cupom de boas-vindas
      couponService.create({
        code: 'BEMVINDO10',
        discount: 0,
        discountPercent: 10,
        type: 'percent',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        isActive: true,
        description: 'Cupom de boas-vindas - 10% de desconto',
      });
    }
  }
};

// Initialize default coupons
if (typeof window !== 'undefined') {
  couponService.createDefaultCoupons();
}
