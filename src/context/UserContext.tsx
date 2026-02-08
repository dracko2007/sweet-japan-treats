import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { firebaseConfigReady, allowLocalOnly } from '@/config/firebase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string; // Stored for demo purposes - in production, use backend authentication
  birthdate?: string;
  address: {
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building?: string;
  };
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  expiresAt: string;
  isUsed: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  items: Array<{
    productName: string;
    size: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shipping?: {
    carrier: string;
    cost: number;
    estimatedDays?: string;
  };
  shippingAddress: {
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building?: string;
  };
}

interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  coupons: Coupon[];
  orders: Order[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string; needsVerification?: boolean }>;
  register: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (userData: Partial<UserProfile>) => void;
  addCoupon: (coupon: Coupon) => void;
  useCoupon: (couponId: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'orderNumber' | 'date'>) => Promise<void> | void;
  clearOrderHistory: () => void;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  // Helper functions for users database
  const getAllUsers = (): UserProfile[] => {
    const usersData = localStorage.getItem('sweet-japan-users');
    if (!usersData) return [];
    
    const usersObj = JSON.parse(usersData);
    // Converte objeto para array
    return Object.values(usersObj);
  };

  const saveAllUsers = (users: UserProfile[]) => {
    // Converte array para objeto com email como chave
    const usersObj: Record<string, UserProfile> = {};
    users.forEach(user => {
      usersObj[user.email] = user;
    });
    localStorage.setItem('sweet-japan-users', JSON.stringify(usersObj));
  };

  const getUserCoupons = (userId: string): Coupon[] => {
    const couponsData = localStorage.getItem(`coupons_${userId}`);
    return couponsData ? JSON.parse(couponsData) : [];
  };

  const saveUserCoupons = (userId: string, coupons: Coupon[]) => {
    localStorage.setItem(`coupons_${userId}`, JSON.stringify(coupons));
  };

  const getUserOrders = (userId: string): Order[] => {
    const ordersData = localStorage.getItem(`orders_${userId}`);
    return ordersData ? JSON.parse(ordersData) : [];
  };

  const saveUserOrders = (userId: string, orders: Order[]) => {
    localStorage.setItem(`orders_${userId}`, JSON.stringify(orders));
  };

  // Helper: sync local orders to Firestore for a user
  const syncLocalOrdersToFirestore = async (userId: string, email: string, localOrders: Order[]) => {
    if (localOrders.length === 0) return;
    console.log(`🔄 [SYNC] Syncing ${localOrders.length} local orders to Firestore for ${email}...`);
    for (const order of localOrders) {
      try {
        await firebaseSyncService.syncOrderToFirestore(userId, {
          ...order,
          orderDate: order.date,
          totalPrice: order.totalAmount,
          customerEmail: email,
        });
      } catch (err) {
        console.warn('⚠️ [SYNC] Failed to sync order:', order.orderNumber, err);
      }
    }
    console.log('✅ [SYNC] Local orders synced to Firestore');
  };

  // Helper: fix old tracking URLs to use the correct format (direct results)
  const fixTrackingUrl = (order: any): any => {
    const trackingNumber = order.trackingNumber;
    const savedUrl = order.trackingUrl || '';
    let carrier = order.carrier || order.shipping?.carrier || '';
    
    // Detect carrier from saved URL if carrier field is empty
    if (!carrier && savedUrl) {
      if (savedUrl.includes('kuronekoyamato')) carrier = 'Yamato';
      else if (savedUrl.includes('sagawa')) carrier = 'Sagawa';
      else if (savedUrl.includes('japanpost')) carrier = 'Japan Post';
      else if (savedUrl.includes('fukutsu')) carrier = 'Fukutsu';
    }
    
    if (!trackingNumber || !carrier) return order;
    
    const lc = carrier.toLowerCase();
    let newUrl = '';
    if (lc.includes('yamato') || lc.includes('クロネコ')) {
      newUrl = `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${trackingNumber}`;
    } else if (lc.includes('sagawa') || lc.includes('佐川')) {
      newUrl = `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}`;
    } else if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('post')) {
      newUrl = `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${trackingNumber}&locale=ja`;
    } else if (lc.includes('fukutsu') || lc.includes('福通')) {
      newUrl = `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${trackingNumber}`;
    }
    
    if (newUrl) {
      return { ...order, trackingUrl: newUrl, carrier: carrier };
    }
    return order;
  };

  // Helper: load orders from Firestore for a user
  const loadOrdersFromFirestore = async (userId: string): Promise<Order[]> => {
    try {
      const firestoreOrders = await firebaseSyncService.getOrdersFromFirestore(userId);
      return firestoreOrders.map((o: any) => {
        const mapped = {
          id: o.id || o.orderNumber,
          orderNumber: o.orderNumber || o.id,
          date: o.date || o.orderDate || o.syncedAt,
          items: o.items || [],
          totalAmount: o.totalAmount || o.totalPrice || 0,
          paymentMethod: o.paymentMethod || '',
          status: o.status || 'pending',
          shippingAddress: o.shippingAddress || {},
          ...(o.trackingNumber && { trackingNumber: o.trackingNumber }),
          ...(o.trackingUrl && { trackingUrl: o.trackingUrl }),
          ...(o.carrier && { carrier: o.carrier }),
          ...(o.shipping && { shipping: o.shipping }),
        };
        // Fix old tracking URLs to use correct format
        return fixTrackingUrl(mapped);
      }) as Order[];
    } catch (err) {
      console.warn('⚠️ [SYNC] Could not load orders from Firestore:', err);
      return [];
    }
  };

  // Merge local + Firestore orders (deduplicate by orderNumber, Firestore takes priority)
  const mergeOrders = (local: Order[], firestore: Order[]): Order[] => {
    const map = new Map<string, Order>();
    // Firestore orders first (source of truth, includes tracking data)
    firestore.forEach(o => map.set(o.orderNumber, o));
    // Local orders: merge but keep Firestore tracking fields if they exist
    local.forEach(o => {
      if (!map.has(o.orderNumber)) {
        map.set(o.orderNumber, fixTrackingUrl(o));
      } else {
        // Firestore already has this order — keep Firestore version (has tracking data)
        const existing = map.get(o.orderNumber)!;
        map.set(o.orderNumber, fixTrackingUrl({ ...o, ...existing }));
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  // Load user data from localStorage on mount AND listen to Firebase auth
  useEffect(() => {
    // IMMEDIATELY load from localStorage so user stays logged in on refresh
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        console.log('⚡ [INIT] Restoring user from localStorage:', userData.email);
        setUser(userData);
        setIsAuthenticated(true);
        const userCoupons = getUserCoupons(userData.id);
        const userOrders = getUserOrders(userData.id).map(fixTrackingUrl);
        setCoupons(userCoupons);
        setOrders(userOrders);
      } catch (e) {
        console.error('❌ [INIT] Failed to parse stored user:', e);
      }
    }

    // Listener do Firebase Auth (will update/enrich data when ready)
    const unsubscribe = firebaseSyncService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔥 [FIREBASE] Auth state changed - user logged in:', firebaseUser.uid);
        
        // Block unverified users (except admin)
        if (!firebaseUser.emailVerified && firebaseUser.email !== 'dracko2007@gmail.com') {
          console.log('🔥 [FIREBASE] User email not verified, signing out:', firebaseUser.email);
          await firebaseSyncService.logoutUser();
          return;
        }
        
        // Busca dados do usuário no Firestore
        const firestoreUser = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
        
        if (firestoreUser) {
          // Merge Firestore data with local data (keep more complete profile)
          const localUser = storedUser ? JSON.parse(localStorage.getItem('user') || '{}') : {};
          const mergedUser: UserProfile = {
            ...localUser,
            ...firestoreUser,
            // Keep the most complete address (Firestore if has data, else local)
            address: (firestoreUser as any).address?.postalCode 
              ? { ...localUser.address, ...(firestoreUser as any).address }
              : localUser.address || (firestoreUser as any).address || {},
            // Keep birthdate from whichever source has it
            birthdate: (firestoreUser as any).birthdate || localUser.birthdate || undefined,
            phone: (firestoreUser as any).phone || localUser.phone || '',
          } as UserProfile;
          
          setUser(mergedUser);
          setIsAuthenticated(true);
          
          // Load local orders
          const localOrders = getUserOrders(mergedUser.id);
          const userCoupons = getUserCoupons(mergedUser.id);
          
          // Load Firestore orders
          const firestoreOrders = await loadOrdersFromFirestore(firebaseUser.uid);
          
          // Merge and set
          const allOrders = mergeOrders(localOrders, firestoreOrders);
          setCoupons(userCoupons);
          setOrders(allOrders);
          
          // Sync any local-only orders UP to Firestore
          const localOnlyOrders = localOrders.filter(
            lo => !firestoreOrders.some(fo => fo.orderNumber === lo.orderNumber)
          );
          if (localOnlyOrders.length > 0) {
            syncLocalOrdersToFirestore(firebaseUser.uid, (firestoreUser as any).email, localOnlyOrders);
          }
          
          localStorage.setItem('user', JSON.stringify(mergedUser));
        }
      } else {
        console.log('🔥 [FIREBASE] Auth state changed - no Firebase user');
        // DON'T clear session - localStorage user may be valid (e.g. admin login)
        // Only clear if there's no stored user either
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('🔥 [FIREBASE] Keeping localStorage session for:', userData.email);
            setUser(userData);
            setIsAuthenticated(true);
            const userCoupons = getUserCoupons(userData.id);
            const userOrders = getUserOrders(userData.id);
            setCoupons(userCoupons);
            setOrders(userOrders);
          } catch (e) {
            console.error('❌ Failed to parse stored user');
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Save current user session to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Save user-specific coupons to localStorage
  useEffect(() => {
    if (user && coupons.length >= 0) {
      saveUserCoupons(user.id, coupons);
    }
  }, [coupons, user]);

  // Save user-specific orders to localStorage
  useEffect(() => {
    if (user && orders.length >= 0) {
      saveUserOrders(user.id, orders);
    }
  }, [orders, user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; code?: string; needsVerification?: boolean }> => {
    const normalizedEmail = normalizeEmail(email);
    // Admin default - sempre disponível
    const ADMIN_EMAIL = 'dracko2007@gmail.com';
    const ADMIN_PASSWORD = 'admin123';
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminUser: UserProfile = {
        id: 'admin-001',
        name: 'Administrador',
        email: ADMIN_EMAIL,
        phone: '070-1367-1679',
        password: ADMIN_PASSWORD,
        address: {
          postalCode: '000-0000',
          prefecture: 'Tokyo',
          city: 'Tokyo',
          address: 'Admin',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      
      setUser(adminUser);
      setIsAuthenticated(true);
      
      const userCoupons = getUserCoupons(adminUser.id);
      const userOrders = getUserOrders(adminUser.id);
      
      setCoupons(userCoupons);
      setOrders(userOrders);
      
      console.log('✅ Admin logged in successfully');
      return { success: true };
    }
    
    if (!firebaseConfigReady && allowLocalOnly) {
      // Local-only login when Firebase is disabled/unavailable
      const allUsers = getAllUsers();
      const foundUser = allUsers.find(u => normalizeEmail(u.email) === normalizedEmail && u.password === password);
      if (foundUser) {
        setUser(foundUser);
        setIsAuthenticated(true);
        const userCoupons = getUserCoupons(foundUser.id);
        const userOrders = getUserOrders(foundUser.id);
        setCoupons(userCoupons);
        setOrders(userOrders);
        localStorage.setItem('user', JSON.stringify(foundUser));
        return { success: true };
      }
      return { success: false, error: 'Email ou senha incorretos. Cadastre-se primeiro caso não tenha uma conta.' };
    }

    try {
      // Login with Firebase Auth - STRICT: user must exist
      console.log('🔥 [LOGIN] Attempting Firebase Auth login...');
      const firebaseUser = await firebaseSyncService.loginUser(normalizedEmail, password);
      
      // FIRST: Check if user actually registered (has profile in Firestore)
      // This catches "ghost users" who exist in Auth but never completed registration
      const userProfile = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
      const localUsers = getAllUsers();
      const localUser = localUsers.find(u => normalizeEmail(u.email) === normalizedEmail);
      
      if (!userProfile && !localUser) {
        // No profile in Firestore or localStorage - user never properly registered
        console.log('⚠️ [LOGIN] Ghost user detected (Auth exists but no profile):', normalizedEmail);
        await firebaseSyncService.logoutUser();
        return { 
          success: false, 
          error: 'Usuário não cadastrado. Crie uma conta primeiro na página de cadastro.' 
        };
      }
      
      // THEN: Check email verification (only for users who actually registered)
      if (!firebaseUser.emailVerified) {
        console.log('⚠️ [LOGIN] Email not verified:', normalizedEmail);
        // Resend verification email before signing out
        try {
          await firebaseSyncService.resendVerificationEmail();
          console.log('📧 [LOGIN] Verification email resent to:', normalizedEmail);
        } catch (e) {
          console.warn('⚠️ [LOGIN] Could not resend verification email:', e);
        }
        // Sign out since unverified
        await firebaseSyncService.logoutUser();
        return { 
          success: false, 
          error: 'Seu email ainda não foi verificado. Reenviamos o link de confirmação para sua caixa de entrada.',
          needsVerification: true
        };
      }
      
      // Get user data - we already have userProfile from above
      console.log('🔥 [LOGIN] Fetching user data from Firestore...');
      let userData = userProfile;
      
      if (!userData) {
        // Use localStorage backup (localUser was already found above)
        if (localUser) {
          await firebaseSyncService.syncUserToFirestore(firebaseUser.uid, { ...localUser, id: firebaseUser.uid });
          userData = { ...localUser, id: firebaseUser.uid };
        }
      }
      
      if (userData) {
        setUser(userData as UserProfile);
        setIsAuthenticated(true);
        
        // Load and merge orders
        const localOrders = getUserOrders(userData.id);
        const firestoreOrders = await loadOrdersFromFirestore(firebaseUser.uid);
        const allOrders = mergeOrders(localOrders, firestoreOrders);
        
        const userCoupons = getUserCoupons(userData.id);
        setCoupons(userCoupons);
        setOrders(allOrders);
        
        // Sync local-only orders UP to Firestore
        const localOnlyOrders = localOrders.filter(
          lo => !firestoreOrders.some(fo => fo.orderNumber === lo.orderNumber)
        );
        if (localOnlyOrders.length > 0) {
          syncLocalOrdersToFirestore(firebaseUser.uid, (userData as any).email, localOnlyOrders);
        }
        
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('✅ User logged in successfully via Firebase:', { email: userData.email, id: userData.id });
        return { success: true };
      }
    } catch (error: any) {
      console.log('⚠️ [LOGIN] Firebase Auth failed:', error?.code);
      
      const authCode = error?.code || '';
      
      if (authCode.includes('api-key-not-valid')) {
        return {
          success: false,
          error: 'API Key inválida. Confirme se a chave é do projeto correto.',
          code: authCode
        };
      }
      
      const isConnectivityError = [
        'auth/unauthorized-domain',
        'auth/network-request-failed',
        'auth/invalid-api-key',
        'auth/operation-not-allowed',
        'auth/configuration-not-found'
      ].some(code => authCode.includes(code));

      if (isConnectivityError) {
        const friendlyMessage = authCode.includes('unauthorized-domain')
          ? `Domínio não autorizado no Firebase. Adicione ${window.location.hostname} em Authentication > Settings > Authorized domains.`
          : authCode.includes('network-request-failed')
            ? 'Falha de rede ao conectar. Verifique sua conexão e tente novamente.'
            : 'Erro de configuração do Firebase.';
        return { success: false, error: friendlyMessage, code: authCode };
      }

      // For invalid credentials - distinguish between unregistered vs wrong password
      const isCredentialError = [
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/wrong-password'
      ].some(code => authCode.includes(code));

      if (isCredentialError) {
        // Check if user exists in Firestore to give proper error message
        try {
          const existingUser = await firebaseSyncService.getUserByEmail(normalizedEmail);
          if (existingUser) {
            // User registered but password is wrong
            return { 
              success: false, 
              error: 'Senha incorreta. Tente novamente ou use "Esqueceu a senha?" para redefinir.' 
            };
          }
        } catch (e) {
          // Firestore check failed, fall through to generic message
        }
        // User not found in Firestore - not registered
        return { 
          success: false, 
          error: 'Usuário não cadastrado. Crie uma conta primeiro.' 
        };
      }
    }
    
    return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
  };

  const register = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedEmail = normalizeEmail(userData.email);
      console.log('🔍 [DEBUG] ===== REGISTER START =====');
      console.log('🔍 [DEBUG] Registration data:', { 
        email: normalizedEmail, 
        name: userData.name 
      });

      // Register user in Firebase Auth (with email verification)
      console.log('🔥 [DEBUG] Registering user in Firebase Auth...');
      let firebaseUser;
      try {
        firebaseUser = await firebaseSyncService.registerUser(normalizedEmail, userData.password);
      } catch (authError: any) {
        if (authError.code && authError.code.includes('api-key-not-valid')) {
          return { success: false, error: 'API Key inválida. Verifique se a chave é do projeto correto.' };
        }
        if ((authError.code && authError.code.includes('email-already-in-use')) || (authError.message && authError.message.includes('email-already-in-use'))) {
          // Ghost user check: exists in Auth but maybe not in Firestore
          console.log('⚠️ [REGISTER] Email already in Auth. Checking for ghost user...');
          try {
            // Try to login with provided password to recover the ghost account
            const ghostUser = await firebaseSyncService.loginUser(normalizedEmail, userData.password);
            
            // Check if profile exists in Firestore
            const existingProfile = await firebaseSyncService.getUserFromFirestore(ghostUser.uid);
            
            if (existingProfile) {
              // Real user with profile - truly already registered
              await firebaseSyncService.logoutUser();
              return { success: false, error: 'Este email já está cadastrado. Faça login na página de login.' };
            }
            
            // Ghost user confirmed: Auth exists but NO Firestore profile
            // Treat as new registration - create profile and send verification
            console.log('👻 [REGISTER] Ghost user confirmed. Creating profile...');
            firebaseUser = ghostUser;
            
            // Resend verification email since they never verified
            if (!ghostUser.emailVerified) {
              try {
                await firebaseSyncService.resendVerificationEmail();
                console.log('📧 [REGISTER] Verification email resent for ghost user');
              } catch (e) {
                console.warn('⚠️ [REGISTER] Could not resend verification:', e);
              }
            }
            // Fall through to profile creation below
          } catch (loginError: any) {
            // Can't login - wrong password for existing Auth account
            console.log('❌ [REGISTER] Ghost user exists but password mismatch');
            await firebaseSyncService.logoutUser().catch(() => {});
            return { success: false, error: 'Este email já existe com outra senha. Tente fazer login ou use "Esqueceu a senha?" para redefinir.' };
          }
        } else if (authError.code && authError.code.includes('weak-password')) {
          return { success: false, error: 'Senha muito fraca. Use pelo menos 6 caracteres.' };
        } else {
          const errorMessage = authError?.code
            ? `Erro no cadastro: ${authError.code}`
            : 'Erro ao criar conta. Tente novamente.';
          return { success: false, error: errorMessage };
        }
      }
      
      const newUser: UserProfile = {
        ...userData,
        email: normalizedEmail,
        id: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        password: userData.password,
      };
      
      // Save to Firestore
      const syncResult = await firebaseSyncService.syncUserToFirestore(newUser.id, newUser);
      
      if (!syncResult) {
        console.error('❌ [CRITICAL] Failed to save user to Firestore. User created in Auth but has no profile.');
        return { success: false, error: 'Falha ao salvar na nuvem. Verifique a configuração do Firebase.' };
      }
      
      // Also save to localStorage as backup
      const allUsers = getAllUsers();
      const updatedUsers = [...allUsers, newUser];
      saveAllUsers(updatedUsers);
      
      // DO NOT auto-login - user must verify email first
      // Sign out the Firebase user created during registration
      await firebaseSyncService.logoutUser();
      
      console.log('✅ [DEBUG] ===== REGISTER COMPLETE - Email verification required =====');
      return { success: true };
    } catch (error) {
      console.error('❌ [DEBUG] Error registering user:', error);
      return { success: false, error: 'Erro ao criar conta. Tente novamente.' };
    }
  };

  const logout = async () => {
    // Save current user's data before logging out (already done by useEffect)
    // Logout from Firebase Auth
    await firebaseSyncService.logoutUser();
    
    // Just clear the current session
    setUser(null);
    setIsAuthenticated(false);
    setCoupons([]);
    setOrders([]);
    
    // Remove only current session, keep users database intact
    localStorage.removeItem('user');
    console.log('User logged out successfully');
  };

  const updateProfile = (userData: Partial<UserProfile>) => {
    if (user) {
      // Deep merge para objetos aninhados como address
      const updatedUser: UserProfile = {
        ...user,
        ...userData,
        // Merge address separadamente para preservar campos não modificados
        address: userData.address 
          ? { ...user.address, ...userData.address }
          : user.address
      };
      
      setUser(updatedUser);
      
      // Also update in users database (localStorage)
      const allUsers = getAllUsers();
      const updatedUsers = allUsers.map(u => 
        u.id === user.id ? updatedUser : u
      );
      saveAllUsers(updatedUsers);
      
      // Sync to Firestore (fire-and-forget)
      firebaseSyncService.syncUserToFirestore(user.id, {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        birthdate: updatedUser.birthdate || null,
        address: updatedUser.address || {},
      }).then(() => {
        console.log('✅ [SYNC] Profile synced to Firestore');
      }).catch(err => {
        console.warn('⚠️ [SYNC] Failed to sync profile to Firestore:', err);
      });
      
      console.log('✅ User profile updated:', { 
        id: updatedUser.id, 
        email: updatedUser.email,
        address: updatedUser.address 
      });
    }
  };

  const addCoupon = (coupon: Coupon) => {
    setCoupons(prev => [...prev, coupon]);
  };

  const useCoupon = (couponId: string) => {
    setCoupons(prev => 
      prev.map(coupon => 
        coupon.id === couponId ? { ...coupon, isUsed: true } : coupon
      )
    );
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'orderNumber' | 'date'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}`,
      orderNumber: `DL-${Date.now().toString().slice(-8)}`,
      date: new Date().toISOString(),
    };
    
    // Atualiza os pedidos do usuário atual
    setOrders(prev => [newOrder, ...prev]);
    
    // Sync to Firestore
    if (user) {
      try {
        await firebaseSyncService.syncOrderToFirestore(user.id, {
          ...newOrder,
          orderDate: newOrder.date,
          totalPrice: newOrder.totalAmount,
          customerEmail: user.email,
          customerName: user.name,
          customerPhone: user.phone,
        });
        console.log('✅ [ORDER] Synced to Firestore:', newOrder.orderNumber);
      } catch (err) {
        console.error('❌ [ORDER] Failed to sync to Firestore:', err);
      }
    }
    
    // Também atualiza na base global de usuários (localStorage backup)
    if (user) {
      const usersData = localStorage.getItem('sweet-japan-users');
      if (usersData) {
        const users = JSON.parse(usersData);
        if (users[user.email]) {
          if (!users[user.email].orders) {
            users[user.email].orders = [];
          }
          users[user.email].orders.unshift({
            ...newOrder,
            orderDate: newOrder.date,
            totalPrice: newOrder.totalAmount,
          });
          localStorage.setItem('sweet-japan-users', JSON.stringify(users));
        }
      }
    }
  };

  const clearOrderHistory = () => {
    setOrders([]);
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await firebaseSyncService.sendPasswordReset(normalizeEmail(email));
      return { success: true };
    } catch (error: any) {
      const code = error?.code || '';
      if (code.includes('user-not-found')) {
        return { success: false, error: 'Nenhuma conta encontrada com este email.' };
      }
      if (code.includes('too-many-requests')) {
        return { success: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };
      }
      return { success: false, error: 'Erro ao enviar email de recuperação. Tente novamente.' };
    }
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    return await firebaseSyncService.resendVerificationEmail();
  };

  const value: UserContextType = {
    user,
    isAuthenticated,
    coupons,
    orders,
    login,
    register,
    logout,
    updateProfile,
    addCoupon,
    useCoupon,
    addOrder,
    clearOrderHistory,
    sendPasswordReset,
    resendVerificationEmail,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
