import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeStorage } from '@/utils/storage';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { firebaseConfigReady, allowLocalOnly, auth } from '@/config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USER_ID, isAdminEmail } from '@/config/admin';
import { adminService } from '@/services/adminService';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string; // Stored for demo purposes - in production, use backend authentication
  birthdate?: string;
  adminRole?: number;         // nível de admin (1/2/3) quando é sessão de admin
  personType?: 'PF' | 'PJ';   // Pessoa Física ou Jurídica
  cnpj?: string;              // se PJ
  razaoSocial?: string;       // se PJ
  whatsappMarketing?: boolean;
  points?: number; // Pontos de fidelidade (reviews, vídeos)
  birthdayBonusYear?: number; // Ano em que já recebeu os 1000 pts de aniversário
  address: {
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building?: string;
  };
  createdAt: string;
  coupons?: Coupon[]; // Cupons do perfil (sincronizados no Firestore)
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  expiresAt: string;
  isUsed: boolean;
  freeShipping?: boolean;
  affiliateCode?: string; // se preenchido, é um código de influencer (gera comissão)
}

// Fábrica do cupom de boas-vindas concedido no cadastro.
export const makeWelcomeCoupon = (): Coupon => ({
  id: `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  code: 'BEMVINDO10',
  description: 'Cupom de boas-vindas — 10% de desconto',
  discount: 10,
  discountType: 'percentage',
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  isUsed: false,
});

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
  isAdmin: boolean;          // agindo como admin (conta admin E modo != cliente)
  isAdminAccount: boolean;   // a conta É admin (independente do modo escolhido)
  adminRole: number;         // 0=não admin, 1/2/3
  permissions: { canDelete: boolean; canFinancial: boolean; canManageAdmins: boolean };
  loginAs: 'admin' | 'user' | null;
  setLoginAs: (mode: 'admin' | 'user') => void;
  coupons: Coupon[];
  orders: Order[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string; needsVerification?: boolean }>;
  register: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (userData: Partial<UserProfile>) => void;
  addPoints: (amount: number) => void;
  addCoupon: (coupon: Coupon) => void;
  useCoupon: (couponId: string) => void;
  consumeCouponByCode: (code: string) => void;
  validateProfileCoupon: (code: string) => { valid: boolean; coupon?: Coupon; error?: string };
  addOrder: (order: Omit<Order, 'id' | 'date'> & { orderNumber?: string }) => Promise<void> | void;
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
  // Modo da sessão para contas admin: 'admin' (painel) ou 'user' (cliente).
  // Escolhido no login; separa o admin do cliente para as telas não se misturarem.
  const [loginAs, setLoginAsState] = useState<'admin' | 'user' | null>(
    () => (safeStorage.getItem('loginAs') as 'admin' | 'user' | null) || null
  );
  const setLoginAs = (mode: 'admin' | 'user') => {
    setLoginAsState(mode);
    safeStorage.setItem('loginAs', mode);
  };
  // Nível do admin vem da própria sessão de admin (login por usuário/nome).
  const adminRole = (user?.id === ADMIN_USER_ID ? (user?.adminRole || 0) : 0);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  // Helper functions for users database
  const getAllUsers = (): UserProfile[] => {
    const usersData = safeStorage.getItem('sweet-japan-users');
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
    safeStorage.setItem('sweet-japan-users', JSON.stringify(usersObj));
  };

  const getUserCoupons = (userId: string): Coupon[] => {
    const couponsData = safeStorage.getItem(`coupons_${userId}`);
    return couponsData ? JSON.parse(couponsData) : [];
  };

  const saveUserCoupons = (userId: string, coupons: Coupon[]) => {
    safeStorage.setItem(`coupons_${userId}`, JSON.stringify(coupons));
  };

  // Resolve a lista de cupons priorizando o que veio do Firestore (userData.coupons),
  // caindo para o localStorage. Garante o cupom de boas-vindas (exceto admin) de
  // forma determinística, e mantém localStorage + Firestore em sincronia.
  const resolveUserCoupons = (userData: { id: string; email?: string; coupons?: Coupon[] }): Coupon[] => {
    let list = Array.isArray(userData.coupons) ? userData.coupons : getUserCoupons(userData.id);

    const isAdmin = userData.id === ADMIN_USER_ID || isAdminEmail(userData.email);
    const hasWelcome = list.some((c) => c.code.toUpperCase() === 'BEMVINDO10');
    if (!isAdmin && !hasWelcome) {
      list = [...list, makeWelcomeCoupon()];
      // Persiste no Firestore para sincronizar entre dispositivos
      firebaseSyncService
        .syncUserToFirestore(userData.id, { coupons: list })
        .catch(() => {});
    }

    saveUserCoupons(userData.id, list);
    return list;
  };

  const getUserOrders = (userId: string): Order[] => {
    const ordersData = safeStorage.getItem(`orders_${userId}`);
    return ordersData ? JSON.parse(ordersData) : [];
  };

  const saveUserOrders = (userId: string, orders: Order[]) => {
    safeStorage.setItem(`orders_${userId}`, JSON.stringify(orders));
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

  // Load user data from safeStorage on mount AND listen to Firebase auth
  useEffect(() => {
    // IMMEDIATELY load from safeStorage so user stays logged in on refresh
    const storedUser = safeStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        console.log('⚡ [INIT] Restoring user from safeStorage:', userData.email);
        setUser(userData);
        setIsAuthenticated(true);
        const userCoupons = resolveUserCoupons(userData);
        const userOrders = getUserOrders(userData.id).map(fixTrackingUrl);
        setCoupons(userCoupons);
        setOrders(userOrders);

        // Se a sessão restaurada for do admin, reautentica no Firebase para liberar
        // a escrita no painel (produtos) — necessário para sessões antigas.
        const isAdminSession = userData.id === ADMIN_USER_ID || isAdminEmail(userData.email);
        if (isAdminSession && auth && !auth.currentUser) {
          signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
            .then(() => console.log('✅ Admin reautenticado no Firebase (sessão restaurada)'))
            .catch((err) => console.warn('⚠️ Falha ao reautenticar admin no Firebase:', err?.code));
        }
      } catch (e) {
        console.error('❌ [INIT] Failed to parse stored user:', e);
      }
    }

    // Listener do Firebase Auth (will update/enrich data when ready)
    const unsubscribe = firebaseSyncService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔥 [FIREBASE] Auth state changed - user logged in:', firebaseUser.uid);

        // Sessão de ADMIN (login por usuário/nome): o Firebase está autenticado só para
        // liberar escrita. NÃO sobrescrever com o perfil de cliente do Firestore.
        try {
          const stored = safeStorage.getItem('user');
          if (stored && JSON.parse(stored)?.id === ADMIN_USER_ID) return;
        } catch { /* ignore */ }
        
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
          const localUser = storedUser ? JSON.parse(safeStorage.getItem('user') || '{}') : {};
          const mergedUser: UserProfile = {
            ...localUser,
            ...firestoreUser,
            // O e-mail AUTENTICADO no Firebase é a fonte da verdade de QUEM logou.
            // Sem isto, um perfil do Firestore podia sobrescrever o e-mail do admin
            // e derrubar o acesso de admin logo após o login.
            email: firebaseUser.email || (firestoreUser as any).email || localUser.email,
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
          const userCoupons = resolveUserCoupons(mergedUser);
          
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
          
          safeStorage.setItem('user', JSON.stringify(mergedUser));
        }
      } else {
        console.log('🔥 [FIREBASE] Auth state changed - no Firebase user');
        // DON'T clear session - safeStorage user may be valid (e.g. admin login)
        // Only clear if there's no stored user either
        const storedUser = safeStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('🔥 [FIREBASE] Keeping safeStorage session for:', userData.email);
            setUser(userData);
            setIsAuthenticated(true);
            const userCoupons = resolveUserCoupons(userData);
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

  // Save current user session to safeStorage
  useEffect(() => {
    if (user) {
      safeStorage.setItem('user', JSON.stringify(user));
    } else {
      safeStorage.removeItem('user');
    }
  }, [user]);

  // Save user-specific coupons to safeStorage
  useEffect(() => {
    if (user && coupons.length >= 0) {
      saveUserCoupons(user.id, coupons);
    }
  }, [coupons, user]);

  // Save user-specific orders to safeStorage
  useEffect(() => {
    if (user && orders.length >= 0) {
      saveUserOrders(user.id, orders);
    }
  }, [orders, user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; code?: string; needsVerification?: boolean }> => {
    const normalizedEmail = normalizeEmail(email);
    // 1) LOGIN DE ADMIN por usuário/nome ("Administrador" ou nome cadastrado) + senha.
    //    Separado dos e-mails de cliente — não mistura com a conta de cliente.
    const admin = await adminService.authenticate(email, password);
    if (admin) {
      const adminUser: UserProfile = {
        id: ADMIN_USER_ID,
        name: admin.name,
        email: ADMIN_EMAIL, // e-mail interno só p/ autenticar no Firebase (escrita no painel)
        phone: '',
        password: ADMIN_PASSWORD,
        adminRole: admin.role,
        address: { postalCode: '', prefecture: '', city: '', address: '' },
        createdAt: new Date().toISOString(),
      };

      setUser(adminUser);
      setIsAuthenticated(true);
      setCoupons([]);
      setOrders([]);
      safeStorage.setItem('user', JSON.stringify(adminUser));

      // Autentica no Firebase (conta admin compartilhada) p/ liberar escrita no painel
      if (auth) {
        try {
          await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        } catch (err) {
          console.warn('⚠️ Admin local OK, mas Firebase Auth falhou:', err);
        }
      }
      console.log(`✅ Admin "${admin.name}" (nível ${admin.role}) logado`);
      return { success: true };
    }
    
    if (!firebaseConfigReady && allowLocalOnly) {
      // Local-only login when Firebase is disabled/unavailable
      const allUsers = getAllUsers();
      const foundUser = allUsers.find(u => normalizeEmail(u.email) === normalizedEmail && u.password === password);
      if (foundUser) {
        setUser(foundUser);
        setIsAuthenticated(true);
        const userCoupons = resolveUserCoupons(foundUser);
        const userOrders = getUserOrders(foundUser.id);
        setCoupons(userCoupons);
        setOrders(userOrders);
        safeStorage.setItem('user', JSON.stringify(foundUser));
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
        // No profile in Firestore or safeStorage - user never properly registered
        console.log('⚠️ [LOGIN] Ghost user detected (Auth exists but no profile):', normalizedEmail);
        await firebaseSyncService.logoutUser();
        return { 
          success: false, 
          error: 'Usuário não cadastrado. Crie uma conta primeiro na página de cadastro.' 
        };
      }
      
      // Verificação de e-mail NÃO é exigida (ambiente de demonstração).
      // O usuário pode entrar logo após o cadastro. Para produção, reative o
      // bloqueio abaixo conferindo firebaseUser.emailVerified.
      if (!firebaseUser.emailVerified) {
        console.log('ℹ️ [LOGIN] E-mail não verificado, mas login liberado (modo demo):', normalizedEmail);
      }

      // Get user data - we already have userProfile from above
      console.log('🔥 [LOGIN] Fetching user data from Firestore...');
      let userData = userProfile;
      
      if (!userData) {
        // Use safeStorage backup (localUser was already found above)
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
        
        const userCoupons = resolveUserCoupons(userData as UserProfile);
        setCoupons(userCoupons);
        setOrders(allOrders);

        // Sync local-only orders UP to Firestore
        const localOnlyOrders = localOrders.filter(
          lo => !firestoreOrders.some(fo => fo.orderNumber === lo.orderNumber)
        );
        if (localOnlyOrders.length > 0) {
          syncLocalOrdersToFirestore(firebaseUser.uid, (userData as any).email, localOnlyOrders);
        }
        
        safeStorage.setItem('user', JSON.stringify(userData));
        
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
      
      // Concede o cupom de boas-vindas no perfil (uso único, vinculado à conta)
      const welcomeCoupon = makeWelcomeCoupon();

      const newUser: UserProfile = {
        ...userData,
        email: normalizedEmail,
        id: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        password: userData.password,
        coupons: [welcomeCoupon],
      };

      // Salva os cupons localmente também (cache)
      saveUserCoupons(newUser.id, [welcomeCoupon]);

      // Salva sempre no backup local (garante login mesmo se a nuvem falhar)
      const allUsers = getAllUsers();
      const updatedUsers = [...allUsers, newUser];
      saveAllUsers(updatedUsers);

      // Tenta salvar no Firestore — NÃO é fatal: o usuário já existe no Auth e
      // no backup local; se a nuvem falhar, o perfil sincroniza no próximo login.
      const syncResult = await firebaseSyncService.syncUserToFirestore(newUser.id, newUser);
      if (!syncResult) {
        console.warn('⚠️ [REGISTER] Falha ao sincronizar perfil na nuvem — seguindo com backup local. Sincroniza no próximo login.');
      }

      // Encerra a sessão criada durante o cadastro (login é feito depois)
      await firebaseSyncService.logoutUser();

      console.log('✅ [REGISTER] Cadastro concluído (sync nuvem:', syncResult, ')');
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
    setLoginAsState(null);

    // Remove only current session, keep users database intact
    safeStorage.removeItem('user');
    safeStorage.removeItem('loginAs');
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
      
      // Also update in users database (safeStorage)
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

  const addPoints = (amount: number) => {
    if (!user || amount === 0) return;
    const newTotal = Math.max(0, (user.points || 0) + amount); // amount<0 = resgate
    const updatedUser: UserProfile = { ...user, points: newTotal };
    setUser(updatedUser);

    // Persiste no banco local de usuários
    const allUsers = getAllUsers();
    const updatedUsers = allUsers.map(u => (u.id === user.id ? updatedUser : u));
    saveAllUsers(updatedUsers);

    // Sincroniza com Firestore (fire-and-forget)
    firebaseSyncService.syncUserToFirestore(user.id, { points: newTotal }).catch(() => {});

    console.log(`✅ +${amount} pontos (total: ${newTotal})`);
  };

  // Persiste a lista de cupons do usuário no localStorage e no Firestore.
  const persistUserCoupons = (updated: Coupon[]) => {
    if (!user) return;
    saveUserCoupons(user.id, updated);
    firebaseSyncService
      .syncUserToFirestore(user.id, { coupons: updated })
      .catch((e) => console.warn('⚠️ Falha ao sincronizar cupons:', e));
  };

  const addCoupon = (coupon: Coupon) => {
    setCoupons(prev => {
      const updated = [...prev, coupon];
      persistUserCoupons(updated);
      return updated;
    });
  };

  const useCoupon = (couponId: string) => {
    setCoupons(prev => {
      const updated = prev.map(coupon =>
        coupon.id === couponId ? { ...coupon, isUsed: true } : coupon
      );
      persistUserCoupons(updated);
      return updated;
    });
  };

  // Consome (marca como usado) um cupom do perfil pelo código — uso único.
  const consumeCouponByCode = (code: string) => {
    const normalized = code.trim().toUpperCase();
    setCoupons(prev => {
      const updated = prev.map(coupon =>
        coupon.code.toUpperCase() === normalized && !coupon.isUsed
          ? { ...coupon, isUsed: true }
          : coupon
      );
      persistUserCoupons(updated);
      return updated;
    });
  };

  // Valida um cupom contra a lista do PERFIL (precisa existir, estar ativo
  // e não usado). É assim que garantimos que só quem possui o cupom usa.
  const validateProfileCoupon = (code: string): { valid: boolean; coupon?: Coupon; error?: string } => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return { valid: false, error: 'Digite um cupom.' };
    const found = coupons.find(c => c.code.toUpperCase() === normalized);
    if (!found) return { valid: false, error: 'Você não possui este cupom.' };
    if (found.isUsed) return { valid: false, error: 'Este cupom já foi utilizado.' };
    if (new Date(found.expiresAt) <= new Date()) return { valid: false, error: 'Cupom expirado.' };
    return { valid: true, coupon: found };
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'date'> & { orderNumber?: string }) => {
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}`,
      orderNumber: orderData.orderNumber || `DL-${Date.now().toString().slice(-8)}`,
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
    
    // Também atualiza na base global de usuários (safeStorage backup)
    if (user) {
      const usersData = safeStorage.getItem('sweet-japan-users');
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
          safeStorage.setItem('sweet-japan-users', JSON.stringify(users));
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
    // Admin = logou pela sessão de admin (usuário/nome). Cliente = login por e-mail.
    isAdminAccount: user?.id === ADMIN_USER_ID && adminRole > 0,
    isAdmin: user?.id === ADMIN_USER_ID && adminRole > 0,
    adminRole,
    permissions: {
      canDelete: adminRole >= 2,
      canFinancial: adminRole >= 3,
      canManageAdmins: adminRole >= 3,
    },
    loginAs,
    setLoginAs,
    coupons,
    orders,
    login,
    register,
    logout,
    updateProfile,
    addPoints,
    addCoupon,
    useCoupon,
    consumeCouponByCode,
    validateProfileCoupon,
    addOrder,
    clearOrderHistory,
    sendPasswordReset,
    resendVerificationEmail,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
