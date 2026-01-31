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
