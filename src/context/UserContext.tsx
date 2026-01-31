import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  register: (userData: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<boolean>;
  logout: () => void;
  updateProfile: (userData: Partial<UserProfile>) => void;
  addCoupon: (coupon: Coupon) => void;
  useCoupon: (couponId: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'orderNumber' | 'date'>) => void;
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

  // Load user data from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedCoupons = localStorage.getItem('coupons');
    const storedOrders = localStorage.getItem('orders');

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    if (storedCoupons) {
      setCoupons(JSON.parse(storedCoupons));
    }
    if (storedOrders) {
      setOrders(JSON.parse(storedOrders));
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('coupons', JSON.stringify(coupons));
  }, [coupons]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulate login - in real app, this would call an API
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      if (userData.email === email) {
        setUser(userData);
        setIsAuthenticated(true);
        return true;
      }
    }
    return false;
  };

  const register = async (userData: Omit<UserProfile, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newUser: UserProfile = {
        ...userData,
        id: `user-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      
      setUser(newUser);
      setIsAuthenticated(true);

      // Add welcome coupon
      const welcomeCoupon: Coupon = {
        id: `coupon-${Date.now()}`,
        code: 'WELCOME10',
        description: 'Cupom de boas-vindas - 10% de desconto',
        discount: 10,
        discountType: 'percentage',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        isUsed: false,
      };
      setCoupons([welcomeCoupon]);

      return true;
    } catch (error) {
      console.error('Error registering user:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setCoupons([]);
    setOrders([]);
    localStorage.removeItem('user');
    localStorage.removeItem('coupons');
    localStorage.removeItem('orders');
  };

  const updateProfile = (userData: Partial<UserProfile>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
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
    setOrders(prev => [newOrder, ...prev]);
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
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
