export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  prices: {
    small: number; // 280g
    large: number; // 800g
  };
  cost?: number; // Custo de aquisição em ¥ (só admin — NÃO aparece para o cliente)
  image: string;
  gallery?: string[]; // Múltiplas imagens do produto
  video?: string; // Vídeo do produto (opcional)
  flavor: string;
  deliveryRestrict?: 'Japão';
}

export interface CartItem {
  product: Product;
  size: 'small' | 'large';
  quantity: number;
}

/* ------------------------------------------------------------------ */
/*  Pedidos                                                             */
/* ------------------------------------------------------------------ */

export type OrderStatusValue =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  productId?: string;
  productName: string;
  name?: string;
  size: 'small' | 'large';
  quantity: number;
  price: number;
  cost?: number; // Custo de aquisição em ¥ no momento da compra (snapshot, admin)
  image?: string;
}

export interface OrderShippingAddress {
  name?: string;
  phone?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  building?: string;
}

export interface Order {
  id?: string;
  orderNumber?: string;
  orderDate?: string;
  date?: string;
  status?: OrderStatusValue | string;
  paymentMethod?: string;
  items: OrderItem[];
  totalPrice?: number;
  totalAmount?: number;
  taxAmount?: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  cpf?: string;
  couponCode?: string;
  couponDiscount?: number;
  shippingCarrier?: string;
  shippingCost?: number;
  shipping?: { cost?: number; carrier?: string };
  shippingAddress?: OrderShippingAddress;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface OrderStatistics {
  totalOrders: number;
  totalRevenue: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersLastMonth: number;
  revenueLastMonth: number;
  pendingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

export interface MonthlyDataPoint {
  month: string;
  orders: number;
  revenue: number;
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