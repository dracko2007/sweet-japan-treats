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
  gallery?: string[]; // Múltiplas imagens do produto
  video?: string; // Vídeo do produto (opcional)
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
export interface Coupon {
  code: string;
  discount: number; // Desconto em valor absoluto (¥)
  discountPercent?: number; // Ou desconto em porcentagem
  type: 'fixed' | 'percent';
  expiryDate: string;
  isActive: boolean;
  usageLimit?: number; // Limite de usos totais
  usedCount: number;
  description: string;
  createdAt: string;
  // Targeting rules
  targetType?: 'all' | 'specific' | 'birthday' | 'loyalty'; // Quem pode usar
  targetEmails?: string[]; // Lista de emails específicos (quando targetType = 'specific')
  minOrders?: number; // Mínimo de pedidos no histórico (quando targetType = 'loyalty')
  freeShipping?: boolean; // Se o cupom dá frete grátis em vez de desconto
}