/**
 * Type definitions for order-related data structures
 */

export interface Product {
  id: number;
  name: string;
  prices: {
    [key: string]: number;
  };
  image: string;
  description?: string;
}

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
}

export interface ShippingInfo {
  carrier: string;
  cost: number;
  estimatedDays: string;
}

export interface FormData {
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building?: string;
}

export interface OrderData {
  formData: FormData;
  items: CartItem[];
  totalPrice: number;
  shipping?: ShippingInfo;
  paymentMethod: 'bank' | 'paypay';
  deliveryTime?: string;
}

export interface OrderItem {
  productName: string;
  size: string;
  quantity: number;
  price: number;
}

export interface ShippingAddress {
  name: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building?: string;
}

export interface Order {
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: 'bank' | 'paypay';
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: ShippingAddress;
}

export interface ShippingLabelData {
  orderNumber: string;
  sender: {
    name: string;
    postalCode: string;
    address: string;
    phone: string;
  };
  recipient: {
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building?: string;
    phone: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    weight?: number;
  }>;
  deliveryTime?: string;
}

export interface EmailOrderData extends OrderData {
  orderNumber: string;
}
