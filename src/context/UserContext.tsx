import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { firebaseSyncService } from '@/services/firebaseSyncService';

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
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }) => Promise<boolean>;
  logout: () => void;
  updateProfile: (userData: Partial<UserProfile>) => void;
  addCoupon: (coupon: Coupon) => void;
  useCoupon: (couponId: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'orderNumber' | 'date'>) => void;
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
          
          // Load user-specific coupons and orders from localStorage (temporariamente)
          const userCoupons = getUserCoupons(firestoreUser.id);
          const userOrders = getUserOrders(firestoreUser.id);
          
          setCoupons(userCoupons);
          setOrders(userOrders);
          
          // Também salva no localStorage para backup
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

  const login = async (email: string, password: string): Promise<boolean> => {
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
      return true;
    }
    
    try {
      // Try to login with Firebase Auth first
      console.log('🔥 [LOGIN] Attempting Firebase Auth login...');
      const firebaseUser = await firebaseSyncService.loginUser(email, password);
      
      // Get user data from Firestore
      console.log('🔥 [LOGIN] Fetching user data from Firestore...');
      let userData = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
      
      // If not in Firestore, check localStorage
      if (!userData) {
        console.log('⚠️ [LOGIN] User not in Firestore, checking localStorage...');
        const allUsers = getAllUsers();
        const localUser = allUsers.find(u => u.email === email);
        
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
             email: email,
             name: email.split('@')[0], // Fallback name
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
        
        // Load user-specific coupons and orders
        const userCoupons = getUserCoupons(userData.id);
        const userOrders = getUserOrders(userData.id);
        
        setCoupons(userCoupons);
        setOrders(userOrders);
        
        // Also save to localStorage for backup
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('✅ User logged in successfully via Firebase:', { email: userData.email, id: userData.id });
        return true;
      }
    } catch (error) {
      console.log('⚠️ [LOGIN] Firebase Auth failed, trying localStorage...', error);
      
      // Fallback to localStorage
      const allUsers = getAllUsers();
      console.log('🔍 Login attempt (localStorage):', { email });
      console.log('📦 Total users in database:', allUsers.length);
      console.log('👥 All registered users:', allUsers.map(u => ({ email: u.email, id: u.id })));
      
      const foundUser = allUsers.find(u => u.email === email && u.password === password);
      
      if (foundUser) {
        try {
          // AUTO-MIGRATION: If local user exists but Firebase failed, try to CREATE Firebase account
          console.log('🔄 [LOGIN] Auto-migrating local user to Firebase...');
          const firebaseUser = await firebaseSyncService.registerUser(email, password);
          
          if (firebaseUser) {
             // Sync user data to Firestore
             const migratedUser = { ...foundUser, id: firebaseUser.uid };
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
             const updatedUsers = allUsers.map(u => u.email === email ? migratedUser : u);
             saveAllUsers(updatedUsers);
             
             console.log('✅ [LOGIN] Auto-migration complete! User synced to cloud.');
             return true;
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
        return true;
      }
    }
    
    console.log('❌ Login failed: User not found or incorrect password');
    console.log('💡 Hint: Did you register first? Check the Register page.');
    return false;
  };

  const register = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }): Promise<boolean> => {
    try {
      console.log('🔍 [DEBUG] ===== REGISTER START =====');
      console.log('🔍 [DEBUG] Registration data:', { 
        email: userData.email, 
        name: userData.name 
      });
      
      // Check if user already exists in Firestore first
      const existingFirebaseUser = await firebaseSyncService.getUserByEmail(userData.email);
      if (existingFirebaseUser) {
        console.error('❌ [DEBUG] Registration failed: User already exists in Firebase:', userData.email);
        return false;
      }
      
      // Check if user with this email already exists in the users database (localStorage)
      const allUsers = getAllUsers();
      console.log('🔍 [DEBUG] Total users before registration:', allUsers.length);
      console.log('🔍 [DEBUG] Existing user emails:', allUsers.map(u => u.email));
      
      const existingUser = allUsers.find(u => u.email === userData.email);
      
      if (existingUser) {
        console.error('❌ [DEBUG] Registration failed: User already exists:', userData.email);
        return false;
      }

      // Register user in Firebase Auth
      console.log('🔥 [DEBUG] Registering user in Firebase Auth...');
      let firebaseUser;
      try {
        firebaseUser = await firebaseSyncService.registerUser(userData.email, userData.password);
      } catch (authError: any) {
        // Handle "email already in use" error
        if (authError.message && authError.message.includes('email-already-in-use')) {
           console.warn('⚠️ [DEBUG] Email already in use in Auth. Trying to recover/login...');
           // Try to login with the password provided
           try {
             firebaseUser = await firebaseSyncService.loginUser(userData.email, userData.password);
             console.log('✅ [DEBUG] Recovered account via login. Check if profile exists...');
             
             // Check if profile REALLY exists now that we are logged in
             const existingProfile = await firebaseSyncService.getUserFromFirestore(firebaseUser.uid);
             if (existingProfile) {
                console.error('❌ [DEBUG] Registration failed: Profile actually exists.');
                return false; // Real duplicate user
             }
             
             // If we are here, we have Auth but NO profile.
             // Proceed to create profile (overwriting the "ghost" user)
             console.log('👻 [DEBUG] Ghost account confirmed. Proceeding to create profile...');
           } catch (loginError) {
             console.error('❌ [DEBUG] Email exists and password invalid:', loginError);
             return false; // Wrong password for existing email
           }
        } else {
           throw authError; // Other errors
        }
      }
      
      const newUser: UserProfile = {
        ...userData,
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
      await firebaseSyncService.syncUserToFirestore(newUser.id, newUser);
      
      // Add new user to users database (localStorage for backup)
      const updatedUsers = [...allUsers, newUser];
      saveAllUsers(updatedUsers);
      
      console.log('🔍 [DEBUG] Total users after registration:', updatedUsers.length);
      
      // Verify save
      const verifyUsers = getAllUsers();
      const verifyUser = verifyUsers.find(u => u.email === userData.email);
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
      return true;
    } catch (error) {
      console.error('❌ [DEBUG] Error registering user:', error);
      return false;
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

  const addOrder = (orderData: Omit<Order, 'id' | 'orderNumber' | 'date'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}`,
      orderNumber: `DL-${Date.now().toString().slice(-8)}`,
      date: new Date().toISOString(),
    };
    
    // Atualiza os pedidos do usuário atual
    setOrders(prev => [newOrder, ...prev]);
    
    // Também atualiza na base global de usuários
    if (user) {
      const usersData = localStorage.getItem('sweet-japan-users');
      if (usersData) {
        const users = JSON.parse(usersData);
        if (users[user.email]) {
          // Adiciona o pedido ao array de pedidos do usuário
          if (!users[user.email].orders) {
            users[user.email].orders = [];
          }
          users[user.email].orders.unshift({
            ...newOrder,
            orderDate: newOrder.date, // Adiciona orderDate para compatibilidade
            totalPrice: newOrder.totalAmount, // Adiciona totalPrice para compatibilidade
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
