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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  register: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (userData: Partial<UserProfile>) => void;
  addCoupon: (coupon: Coupon) => void;
  useCoupon: (couponId: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'orderNumber' | 'date'>) => Promise<void> | void;
  clearOrderHistory: () => void;
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

  // Helper: load orders from Firestore for a user
  const loadOrdersFromFirestore = async (userId: string): Promise<Order[]> => {
    try {
      const firestoreOrders = await firebaseSyncService.getOrdersFromFirestore(userId);
      return firestoreOrders.map((o: any) => ({
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
      })) as Order[];
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
        map.set(o.orderNumber, o);
      } else {
        // Firestore already has this order — keep Firestore version (has tracking data)
        const existing = map.get(o.orderNumber)!;
        map.set(o.orderNumber, { ...o, ...existing });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  // Load user data from localStorage on mount AND listen to Firebase auth
  useEffect(() => {
    // Listener do Firebase Auth
    const unsubscribe = firebaseSyncService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔥 [FIREBASE] Auth state changed - user logged in:', firebaseUser.uid);
        
        // Busca dados do usuário no Firestore
        const firestoreUser = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
        
        if (firestoreUser) {
          setUser(firestoreUser as UserProfile);
          setIsAuthenticated(true);
          
          // Load local orders
          const localOrders = getUserOrders(firestoreUser.id);
          const userCoupons = getUserCoupons(firestoreUser.id);
          
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
          
          localStorage.setItem('user', JSON.stringify(firestoreUser));
        }
      } else {
        console.log('🔥 [FIREBASE] Auth state changed - user logged out');
        // Tenta carregar do localStorage como fallback
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsAuthenticated(true);
          
          const userCoupons = getUserCoupons(userData.id);
          const userOrders = getUserOrders(userData.id);
          
          setCoupons(userCoupons);
          setOrders(userOrders);
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

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; code?: string }> => {
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
      
      // Load admin coupons and orders
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
      return { success: false, error: 'Email ou senha incorretos. Verifique seus dados ou cadastre-se.' };
    }

    try {
      // Try to login with Firebase Auth first
      console.log('🔥 [LOGIN] Attempting Firebase Auth login...');
      const firebaseUser = await firebaseSyncService.loginUser(normalizedEmail, password);
      
      // Get user data from Firestore
      console.log('🔥 [LOGIN] Fetching user data from Firestore...');
      let userData = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
      
      // If not in Firestore, check localStorage
      if (!userData) {
        console.log('⚠️ [LOGIN] User not in Firestore, checking localStorage...');
        const allUsers = getAllUsers();
        const localUser = allUsers.find(u => normalizeEmail(u.email) === normalizedEmail);
        
        if (localUser) {
          // Sync to Firestore
          await firebaseSyncService.syncUserToFirestore(firebaseUser.uid, {
            ...localUser,
            id: firebaseUser.uid
          });
          userData = { ...localUser, id: firebaseUser.uid };
        } else {
           // USER HAS AUTH BUT NO PROFILE (GHOST USER)
           // Create a partial profile to allow login
           console.warn('👻 [LOGIN] Ghost user detected (Auth ok, but no profile). Creating basic profile...');
           const ghostUser: UserProfile = {
             id: firebaseUser.uid,
             email: normalizedEmail,
             name: normalizedEmail.split('@')[0], // Fallback name
             phone: '',
             password: password,
             address: {
               postalCode: '',
               prefecture: '',
               city: '',
               address: '',
             },
             createdAt: new Date().toISOString(),
           };
           
           await firebaseSyncService.syncUserToFirestore(firebaseUser.uid, ghostUser);
           userData = ghostUser;
        }
      }
      
      if (userData) {
        setUser(userData as UserProfile);
        setIsAuthenticated(true);
        
        // Load local orders + Firestore orders and merge
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
        
        // Also save to localStorage for backup
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('✅ User logged in successfully via Firebase:', { email: userData.email, id: userData.id });
        return { success: true };
      }
    } catch (error: any) {
      console.log('⚠️ [LOGIN] Firebase Auth failed, trying localStorage...', error);
      
      const authCode = error?.code || '';
      if (authCode.includes('api-key-not-valid')) {
        return {
          success: false,
          error: 'API Key inválida. Confirme se a chave é do projeto correto e se não há restrições no Google Cloud (HTTP referrers). Depois faça redeploy.',
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
            ? 'Falha de rede ao conectar no Firebase. Verifique sua conexão e tente novamente.'
            : 'Erro de configuração do Firebase. Verifique as credenciais e o domínio autorizado.';

        return { success: false, error: friendlyMessage, code: authCode };
      }

      // For invalid-credential or user-not-found, try Firestore + localStorage fallback + auto-migration
      const isCredentialError = [
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/wrong-password'
      ].some(code => authCode.includes(code));

      if (isCredentialError) {
        // Step 1: Check Firestore for migrated users (works from any device)
        console.log('🔍 [LOGIN] Checking Firestore for migrated user...');
        try {
          const firestoreUser = await firebaseSyncService.getUserByEmail(normalizedEmail);
          if (firestoreUser && (firestoreUser as any).password === password) {
            console.log('✅ [LOGIN] User found in Firestore! Auto-creating Firebase Auth account...');
            
            // Create Firebase Auth account for this user
            try {
              const firebaseUser = await firebaseSyncService.registerUser(normalizedEmail, password);
              
              if (firebaseUser) {
                // Update user in Firestore with new Firebase UID
                const migratedUser = { ...(firestoreUser as UserProfile), id: firebaseUser.uid };
                await firebaseSyncService.syncUserToFirestore(firebaseUser.uid, migratedUser);
                
                setUser(migratedUser);
                setIsAuthenticated(true);
                
                // Load orders from Firestore
                const firestoreOrders = await firebaseSyncService.getOrdersFromFirestore(firebaseUser.uid);
                setOrders(firestoreOrders as Order[]);
                setCoupons(getUserCoupons(firebaseUser.uid));
                
                localStorage.setItem('user', JSON.stringify(migratedUser));
                console.log('✅ [LOGIN] Migrated user now has Firebase Auth! ID:', firebaseUser.uid);
                return { success: true };
              }
            } catch (regError: any) {
              console.warn('⚠️ [LOGIN] Could not auto-register in Auth:', regError.message);
              // Still allow login with Firestore data
              const userData = firestoreUser as UserProfile;
              setUser(userData);
              setIsAuthenticated(true);
              setCoupons(getUserCoupons(userData.id));
              setOrders(getUserOrders(userData.id));
              localStorage.setItem('user', JSON.stringify(userData));
              console.log('✅ [LOGIN] Logged in via Firestore data (no Auth account yet)');
              return { success: true };
            }
          } else if (firestoreUser) {
            console.log('❌ [LOGIN] User found in Firestore but password mismatch');
            return { success: false, error: 'Senha incorreta. Verifique seus dados.' };
          }
        } catch (firestoreError) {
          console.warn('⚠️ [LOGIN] Firestore lookup failed:', firestoreError);
        }
      }

      // Step 2: Fallback to localStorage (for users on the same device)
      const allUsers = getAllUsers();
      console.log('🔍 Login attempt (localStorage):', { email });
      console.log('📦 Total users in database:', allUsers.length);
      console.log('👥 All registered users:', allUsers.map(u => ({ email: u.email, id: u.id })));
      
      const foundUser = allUsers.find(u => normalizeEmail(u.email) === normalizedEmail && u.password === password);
      
      if (foundUser) {
        try {
          // AUTO-MIGRATION: If local user exists but Firebase failed, try to CREATE Firebase account
          console.log('🔄 [LOGIN] Auto-migrating local user to Firebase...');
          const firebaseUser = await firebaseSyncService.registerUser(normalizedEmail, password);
          
          if (firebaseUser) {
             // Sync user data to Firestore
             const migratedUser = { ...foundUser, id: firebaseUser.uid, email: normalizedEmail };
             await firebaseSyncService.syncUserToFirestore(firebaseUser.uid, migratedUser);
             
             // Sync orders if any
             const userOrders = getUserOrders(foundUser.id);
             for (const order of userOrders) {
               await firebaseSyncService.syncOrderToFirestore(firebaseUser.uid, order);
             }
             
             // Update local state with new ID
             setUser(migratedUser);
             setIsAuthenticated(true);
             setCoupons(getUserCoupons(foundUser.id)); // Keep coupons
             setOrders(userOrders);
             
             // Update in localStorage users database (replace old ID with new UID)
             const updatedUsers = allUsers.map(u => normalizeEmail(u.email) === normalizedEmail ? migratedUser : u);
             saveAllUsers(updatedUsers);
             
             console.log('✅ [LOGIN] Auto-migration complete! User synced to cloud.');
             return { success: true };
          }
        } catch (migrationError: any) {
          // If migration fails (e.g. email already exists in auth but not syncronized?)
          console.warn('⚠️ [LOGIN] Auto-migration failed, falling back to local only:', migrationError.message);
          
          if (migrationError.message.includes('email-already-in-use')) {
             // Edge case: Account exists in Auth but login failed previously (wrong password?)
             // OR password is correct but login code above failed for network reasons?
             // We just continue with local login.
          }
        }

        // Standard local login (fallback)
        setUser(foundUser);
        setIsAuthenticated(true);
        
        // Load user-specific coupons and orders
        const userCoupons = getUserCoupons(foundUser.id);
        const userOrders = getUserOrders(foundUser.id);
        
        setCoupons(userCoupons);
        setOrders(userOrders);
        
        console.log('✅ User logged in successfully (localStorage):', { email: foundUser.email, id: foundUser.id });
        return { success: true };
      }
    }
    
    console.log('❌ Login failed: User not found or incorrect password');
    console.log('💡 Hint: Did you register first? Check the Register page.');
    return { success: false, error: 'Email ou senha incorretos. Verifique seus dados ou cadastre-se.' };
  };

  const register = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedEmail = normalizeEmail(userData.email);
      console.log('🔍 [DEBUG] ===== REGISTER START =====');
      console.log('🔍 [DEBUG] Registration data:', { 
        email: normalizedEmail, 
        name: userData.name 
      });
      
      // Removed preemptive Firestore check to allow recovery of Ghost Users
      // We rely on Auth uniqueness and the catch block below to handle duplicates
      
      // Check if user with this email already exists in the users database (localStorage)
      const allUsers = getAllUsers();
      console.log('🔍 [DEBUG] Total users before registration:', allUsers.length);
      console.log('🔍 [DEBUG] Existing user emails:', allUsers.map(u => u.email));
      
      const existingUser = allUsers.find(u => normalizeEmail(u.email) === normalizedEmail);
      
      if (existingUser) {
        console.warn('⚠️ [DEBUG] User already exists locally. Attempting auto-login instead of register.');
        if (existingUser.password === userData.password) {
          setUser(existingUser);
          setIsAuthenticated(true);
          
          const userCoupons = getUserCoupons(existingUser.id);
          const userOrders = getUserOrders(existingUser.id);
          
          setCoupons(userCoupons);
          setOrders(userOrders);
          
          localStorage.setItem('user', JSON.stringify(existingUser));
          return { success: true };
        }
        console.error('❌ [DEBUG] Registration failed: User exists locally and password mismatch.');
        return { success: false, error: 'Este email já está cadastrado. Verifique a senha.' };
      }

      if (!firebaseConfigReady && allowLocalOnly) {
        // Local-only register when Firebase is disabled/unavailable
        const newUser: UserProfile = {
          ...userData,
          email: normalizedEmail,
          id: `user-${Date.now()}`,
          createdAt: new Date().toISOString(),
          password: userData.password,
          orders: [],
        };

        const updatedUsers = [...allUsers, newUser];
        saveAllUsers(updatedUsers);
        setUser(newUser);
        setIsAuthenticated(true);
        setCoupons([]);
        setOrders([]);
        localStorage.setItem('user', JSON.stringify(newUser));
        return { success: true };
      }

      // Register user in Firebase Auth
      console.log('🔥 [DEBUG] Registering user in Firebase Auth...');
      let firebaseUser;
      try {
        firebaseUser = await firebaseSyncService.registerUser(normalizedEmail, userData.password);
      } catch (authError: any) {
        // Handle "email already in use" error
        if (authError.code && authError.code.includes('api-key-not-valid')) {
          return { success: false, error: 'API Key inválida. Verifique se a chave é do projeto correto e se não há restrições no Google Cloud.' };
        }
        if ((authError.code && authError.code.includes('email-already-in-use')) || (authError.message && authError.message.includes('email-already-in-use'))) {
           console.warn('⚠️ [DEBUG] Email already in use in Auth. Trying to recover/login...');
           // Try to login with the password provided
           try {
             firebaseUser = await firebaseSyncService.loginUser(normalizedEmail, userData.password);
             console.log('✅ [DEBUG] Recovered account via login. Check if profile exists...');
             
             // Check if profile REALLY exists now that we are logged in
             const existingProfile = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
             if (existingProfile) {
               console.warn('⚠️ [DEBUG] Profile already exists. Logging in instead of registering.');
               setUser(existingProfile as UserProfile);
               setIsAuthenticated(true);
                
               const userCoupons = getUserCoupons((existingProfile as UserProfile).id);
               const userOrders = getUserOrders((existingProfile as UserProfile).id);
                
               setCoupons(userCoupons);
               setOrders(userOrders);
                
               localStorage.setItem('user', JSON.stringify(existingProfile));
               return { success: true }; // Treat as login success
             }
             
             // If we are here, we have Auth but NO profile.
             // Proceed to create profile (overwriting the "ghost" user)
             console.log('👻 [DEBUG] Ghost account confirmed. Proceeding to create profile...');
           } catch (loginError) {
             console.error('❌ [DEBUG] Email exists and password invalid:', loginError);
             return { success: false, error: 'Email já está cadastrado com outra senha.' }; // Wrong password for existing email
           }
        } else {
           const errorMessage = authError?.code
             ? `Erro no cadastro: ${authError.code}`
             : 'Erro ao criar conta. Tente novamente.';
           return { success: false, error: errorMessage }; // Other errors
        }
      }
      
      const newUser: UserProfile = {
        ...userData,
        email: normalizedEmail,
        id: firebaseUser.uid, // Use Firebase UID
        createdAt: new Date().toISOString(),
        password: userData.password, // Store password (demo only - use backend auth in production)
        orders: [], // Initialize empty orders array
      };
      
      console.log('🔍 [DEBUG] New user created:', { 
        id: newUser.id, 
        email: newUser.email,
        hasOrders: Array.isArray(newUser.orders)
      });
      
      // Save to Firestore
      console.log('🔥 [DEBUG] Saving user to Firestore...');
      const syncValues = await firebaseSyncService.syncUserToFirestore(newUser.id, newUser);
      
      if (!syncValues) {
        console.error('❌ [CRITICAL] Failed to save user to Firestore. User created in Auth but has no profile.');
        return { success: false, error: 'Falha ao salvar na nuvem. Verifique a configuração do Firebase.' };
      } else {
        console.log('✅ [DEBUG] User successfully saved to Firestore');
      }
      
      // Add new user to users database (localStorage for backup)
      const updatedUsers = [...allUsers, newUser];
      saveAllUsers(updatedUsers);
      
      console.log('🔍 [DEBUG] Total users after registration:', updatedUsers.length);
      
      // Verify save
      const verifyUsers = getAllUsers();
      const verifyUser = verifyUsers.find(u => normalizeEmail(u.email) === normalizedEmail);
      console.log('✅ [DEBUG] User saved verification:', {
        found: !!verifyUser,
        email: verifyUser?.email,
        hasOrdersArray: Array.isArray(verifyUser?.orders)
      });
      
      // Set as current user
      setUser(newUser);
      setIsAuthenticated(true);
      console.log('✅ [DEBUG] User set as authenticated');

      // Add welcome coupon for this user
      const welcomeCoupon: Coupon = {
        id: `coupon-${Date.now()}`,
        code: 'BEMVINDO10',
        description: 'Cupom de boas-vindas - 10% de desconto',
        discount: 10,
        discountType: 'percentage',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        isUsed: false,
      };
      setCoupons([welcomeCoupon]);
      
      // Initialize empty orders for this user
      setOrders([]);

      console.log('✅ [DEBUG] ===== REGISTER COMPLETE =====');
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
      
      // Also update in users database
      const allUsers = getAllUsers();
      const updatedUsers = allUsers.map(u => 
        u.id === user.id ? updatedUser : u
      );
      saveAllUsers(updatedUsers);
      
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
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
