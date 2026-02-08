import type { Coupon } from '@/types';

const STORAGE_KEY = 'sweet-japan-coupons';
const FIRESTORE_COUPONS = 'coupons';
const FIRESTORE_USAGE = 'coupon_usage';

// ==================== FIRESTORE HELPERS ====================

// Sync a single coupon to Firestore
const syncCouponToFirestore = async (coupon: Coupon) => {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('@/config/firebase');
    if (!db) return;
    await setDoc(doc(db, FIRESTORE_COUPONS, coupon.code), {
      ...coupon,
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ [COUPON] Synced to Firestore:', coupon.code);
  } catch (err) {
    console.warn('⚠️ [COUPON] Failed to sync coupon to Firestore:', err);
  }
};

// Delete coupon from Firestore
const deleteCouponFromFirestore = async (code: string) => {
  try {
    const { doc, deleteDoc } = await import('firebase/firestore');
    const { db } = await import('@/config/firebase');
    if (!db) return;
    await deleteDoc(doc(db, FIRESTORE_COUPONS, code));
    console.log('✅ [COUPON] Deleted from Firestore:', code);
  } catch (err) {
    console.warn('⚠️ [COUPON] Failed to delete coupon from Firestore:', err);
  }
};

// Load all coupons from Firestore and merge with localStorage
const loadCouponsFromFirestore = async (): Promise<Coupon[]> => {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('@/config/firebase');
    if (!db) return [];
    
    const snapshot = await getDocs(collection(db, FIRESTORE_COUPONS));
    const firestoreCoupons: Coupon[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      firestoreCoupons.push({
        code: data.code || doc.id,
        discount: data.discount || 0,
        discountPercent: data.discountPercent,
        type: data.type || 'percent',
        expiryDate: data.expiryDate,
        isActive: data.isActive !== false,
        usageLimit: data.usageLimit,
        usedCount: data.usedCount || 0,
        description: data.description || '',
        createdAt: data.createdAt || new Date().toISOString(),
        targetType: data.targetType || 'all',
        targetEmails: data.targetEmails || undefined,
        minOrders: data.minOrders || undefined,
        freeShipping: data.freeShipping || false,
      });
    });
    
    // Merge: Firestore takes priority, then add local-only ones
    const localCoupons = couponService.getAll();
    const map = new Map<string, Coupon>();
    firestoreCoupons.forEach(c => map.set(c.code, c));
    localCoupons.forEach(c => { if (!map.has(c.code)) map.set(c.code, c); });
    
    const merged = Array.from(map.values());
    // Update localStorage with merged data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    
    console.log('✅ [COUPON] Loaded from Firestore:', firestoreCoupons.length, 'coupons');
    return merged;
  } catch (err) {
    console.warn('⚠️ [COUPON] Failed to load coupons from Firestore:', err);
    return couponService.getAll();
  }
};

// Sync coupon usage to Firestore
const syncUsageToFirestore = async (couponCode: string, userEmail: string) => {
  try {
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/config/firebase');
    if (!db) return;
    
    const usageRef = doc(db, FIRESTORE_USAGE, couponCode.toUpperCase());
    const usageDoc = await getDoc(usageRef);
    const usedBy = usageDoc.exists() ? (usageDoc.data().usedBy || []) : [];
    
    if (!usedBy.includes(userEmail)) {
      usedBy.push(userEmail);
      await setDoc(usageRef, { usedBy, updatedAt: new Date().toISOString() });
      console.log('✅ [COUPON] Usage synced to Firestore:', couponCode, userEmail);
    }
  } catch (err) {
    console.warn('⚠️ [COUPON] Failed to sync usage to Firestore:', err);
  }
};

// Check coupon usage from Firestore
const checkUsageFromFirestore = async (couponCode: string, userEmail: string): Promise<boolean> => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/config/firebase');
    if (!db) return false;
    
    const usageRef = doc(db, FIRESTORE_USAGE, couponCode.toUpperCase());
    const usageDoc = await getDoc(usageRef);
    if (usageDoc.exists()) {
      const usedBy = usageDoc.data().usedBy || [];
      return usedBy.includes(userEmail);
    }
    return false;
  } catch (err) {
    console.warn('⚠️ [COUPON] Failed to check usage from Firestore:', err);
    return false;
  }
};

export const couponService = {
  // Check if a coupon is eligible for a given user based on targeting rules
  checkTargetEligibility: (coupon: Coupon, userEmail?: string, userBirthdate?: string, userTotalOrders?: number): boolean => {
    const targetType = coupon.targetType || 'all';
    
    if (targetType === 'all') return true;
    
    if (targetType === 'specific') {
      // Only specific emails can use this coupon
      if (!userEmail || !coupon.targetEmails?.length) return false;
      return coupon.targetEmails.some(e => e.toLowerCase() === userEmail.toLowerCase());
    }
    
    if (targetType === 'birthday') {
      // Only users whose birthday month matches current month
      if (!userBirthdate) return false;
      const now = new Date();
      const birthDate = new Date(userBirthdate);
      return birthDate.getMonth() === now.getMonth();
    }
    
    if (targetType === 'loyalty') {
      // Only users with at least N total orders
      const minOrders = coupon.minOrders || 1;
      return (userTotalOrders || 0) >= minOrders;
    }
    
    return true;
  },

  // Get all coupons from localStorage (sync/fast)
  getAll: (): Coupon[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  // Get all coupons from Firestore + merge with localStorage (async)
  getAllAsync: async (): Promise<Coupon[]> => {
    return await loadCouponsFromFirestore();
  },

  // Get active coupons (sync, from localStorage)
  getActive: (): Coupon[] => {
    const coupons = couponService.getAll();
    const now = new Date();
    return coupons.filter(c => 
      c.isActive && 
      new Date(c.expiryDate) > now &&
      (!c.usageLimit || c.usedCount < c.usageLimit)
    );
  },

  // Get active coupons from Firestore (async)
  getActiveAsync: async (): Promise<Coupon[]> => {
    const coupons = await loadCouponsFromFirestore();
    const now = new Date();
    return coupons.filter(c => 
      c.isActive && 
      new Date(c.expiryDate) > now &&
      (!c.usageLimit || c.usedCount < c.usageLimit)
    );
  },

  // Validate and get coupon by code (with user email check)
  validateCoupon: (code: string, userEmail?: string): { valid: boolean; coupon?: Coupon; error?: string } => {
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

    // Check if user has already used this coupon
    if (userEmail) {
      const usedBy = couponService.getCouponUsage(code);
      if (usedBy.includes(userEmail)) {
        return { valid: false, error: 'Você já usou este cupom' };
      }
    }

    return { valid: true, coupon };
  },

  // Async validation: loads coupons from Firestore first, then checks usage
  validateCouponAsync: async (code: string, userEmail?: string): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> => {
    // Load latest coupons from Firestore so client has admin-created ones
    await loadCouponsFromFirestore();
    
    // Now do local validation (localStorage is up to date)
    const localResult = couponService.validateCoupon(code, userEmail);
    if (!localResult.valid) return localResult;
    
    // Then check Firestore for usage
    if (userEmail) {
      const usedInFirestore = await checkUsageFromFirestore(code, userEmail);
      if (usedInFirestore) {
        return { valid: false, error: 'Você já usou este cupom' };
      }
    }
    
    return localResult;
  },

  // Calculate discount
  calculateDiscount: (coupon: Coupon, subtotal: number): number => {
    if (coupon.type === 'fixed') {
      return Math.min(coupon.discount, subtotal);
    } else {
      return Math.round(subtotal * (coupon.discountPercent || 0) / 100);
    }
  },

  // Use coupon (increment usage and track user) - saves to localStorage AND Firestore
  useCoupon: (code: string, userEmail: string): void => {
    const coupons = couponService.getAll();
    const index = coupons.findIndex(c => c.code.toUpperCase() === code.toUpperCase());
    
    if (index !== -1) {
      coupons[index].usedCount += 1;
      
      // Track which users have used this coupon (localStorage)
      const usageKey = `coupon_usage_${code.toUpperCase()}`;
      const usedBy = JSON.parse(localStorage.getItem(usageKey) || '[]');
      if (!usedBy.includes(userEmail)) {
        usedBy.push(userEmail);
        localStorage.setItem(usageKey, JSON.stringify(usedBy));
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
      
      // Sync usage to Firestore (fire-and-forget)
      syncUsageToFirestore(code, userEmail);
      // Also update the coupon usedCount in Firestore
      syncCouponToFirestore(coupons[index]);
    }
  },

  // Get users who used a coupon
  getCouponUsage: (code: string): string[] => {
    const usageKey = `coupon_usage_${code.toUpperCase()}`;
    return JSON.parse(localStorage.getItem(usageKey) || '[]');
  },

  // Create new coupon - saves to localStorage AND Firestore
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
    
    // Sync to Firestore (fire-and-forget)
    syncCouponToFirestore(newCoupon);
    
    return newCoupon;
  },

  // Update coupon - saves to localStorage AND Firestore
  update: (code: string, updates: Partial<Coupon>): boolean => {
    const coupons = couponService.getAll();
    const index = coupons.findIndex(c => c.code === code);
    
    if (index !== -1) {
      coupons[index] = { ...coupons[index], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
      
      // Sync to Firestore (fire-and-forget)
      syncCouponToFirestore(coupons[index]);
      
      return true;
    }
    return false;
  },

  // Delete coupon - removes from localStorage AND Firestore
  delete: (code: string): boolean => {
    const coupons = couponService.getAll();
    const filtered = coupons.filter(c => c.code !== code);
    
    if (filtered.length < coupons.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      
      // Delete from Firestore (fire-and-forget)
      deleteCouponFromFirestore(code);
      
      return true;
    }
    return false;
  },

  // Sync all local coupons to Firestore (useful for initial migration)
  syncAllToFirestore: async (): Promise<void> => {
    const coupons = couponService.getAll();
    for (const coupon of coupons) {
      await syncCouponToFirestore(coupon);
    }
    console.log('✅ [COUPON] All local coupons synced to Firestore');
  },

  // Load coupons from Firestore into localStorage (for clients)
  loadFromFirestore: async (): Promise<Coupon[]> => {
    return await loadCouponsFromFirestore();
  },

  // Create default welcome coupon (only if no coupons exist anywhere)
  createDefaultCoupons: async (): Promise<void> => {
    // First try loading from Firestore
    const firestoreCoupons = await loadCouponsFromFirestore();
    
    if (firestoreCoupons.length === 0) {
      // No coupons anywhere - create the welcome coupon
      couponService.create({
        code: 'BEMVINDO10',
        discount: 0,
        discountPercent: 10,
        type: 'percent',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        description: 'Cupom de boas-vindas - 10% de desconto',
      });
    }
  }
};

// Initialize: load coupons from Firestore on startup
if (typeof window !== 'undefined') {
  couponService.createDefaultCoupons();
}
