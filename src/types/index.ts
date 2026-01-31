export interface Product {
  id: string;
  name: string;
  description: string;
  category: 'artesanal' | 'premium';
  prices: {
    small: number; // 280g
    large: number; // 800g
  };
  image: string;
  flavor: string;
}

export interface CartItem {
  product: Product;
  size: 'small' | 'large';
  quantity: number;
}

export interface ShippingRate {
  carrier: string;
  price: number;
  estimatedDays: string;
}

export type Prefecture = {
  name: string;
  nameJa: string;
  zone: number; // Zone for shipping calculation
};

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday?: string;
  address?: {
    prefecture: string;
    city: string;
    street: string;
    zipCode: string;
  };
  createdAt: string;
}

export interface Coupon {
  code: string;
  discount: number; // percentage or fixed amount
  discountType: 'percentage' | 'fixed';
  expiresAt?: string;
  isActive: boolean;
  usageLimit?: number;
  usedCount: number;
}

export interface ShippingOption {
  carrier: 'yuubin' | 'yamato' | 'sagawa';
  carrierName: string;
  logo: string;
  cost: number;
  estimatedDays: string;
  deliveryTime?: string;
  website: string;
}

export interface Order {
  id: string;
  userId?: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  shippingOption: ShippingOption;
  paymentMethod: 'deposit' | 'paypal';
  couponCode?: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    address: {
      prefecture: string;
      city: string;
      street: string;
      zipCode: string;
    };
  };
  createdAt: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
}
