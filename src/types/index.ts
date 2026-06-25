// Variante de preço de um produto (Pequeno, Médio, Grande, Kit...). O `id` é
// usado como "size" no carrinho. Produtos antigos sem `variants` usam prices.small/large.
export interface ProductVariant {
  id: string;      // estável (ex: 'small', 'kit-3', 'var-abc')
  label: string;   // exibido ao cliente (ex: 'Pequeno', 'Kit 3 unidades')
  price: number;   // em ¥
}

export interface ProductPackageDimensionsCm {
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  source?: 'yahoo' | 'rakuten' | 'manual' | string;
  raw?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  prices: {
    small: number; // 280g
    large: number; // 800g
  };
  variants?: ProductVariant[]; // se presente, substitui prices (vários tamanhos/kits)
  cost?: number; // Custo de aquisição em ¥ (só admin — NÃO aparece para o cliente)
  image: string;
  thumbnail?: string; // WebP 300px ~30KB — usado nos cards de lista
  gallery?: string[]; // Múltiplas imagens do produto
  video?: string; // Vídeo do produto (opcional)
  flavor: string;
  // 'exterior-only' = produto japonês, só vende fora do Japão
  // 'japan-only'    = produto importado (ex: brasileiro), só vende dentro do Japão
  // undefined       = sem restrição (vende em qualquer destino)
  deliveryRestrict?: 'exterior-only' | 'japan-only';
  origin?: 'importado'; // marca produtos importados (ex: brasileiros) dentro das categorias
  hidden?: boolean;          // Registrado mas não publicado na loja (oculto do cliente)
  discountPercent?: number;  // Desconto promocional em % (0–100). >0 ativa a promoção.
  // Traduções por idioma (geradas via IA no cadastro). Mostra automático conforme o idioma do cliente.
  i18n?: Record<string, { name?: string; description?: string }>;
  weightGrams?: number;      // Peso real da embalagem em g (para cálculo de frete); se ausente, estimado por categoria.
  packageDimensionsCm?: ProductPackageDimensionsCm; // Medidas da embalagem/produto em cm, sem margem de seguranca.
  tags?: string[];           // Tipos/subcategorias para filtro inteligente (ex: 'shampoo', 'filtro solar')
  noPsFee?: boolean;         // true = isenta a taxa de Personal Shopper (¥1000/un) deste produto
  isNew?: boolean;           // Marca como lançamento (aparece em destaque no filtro "Lançamento")
  salesCount?: number;       // Quantidade vendida (usado no filtro "Mais Vendidos"); atualizado manualmente pelo admin
  stock?: { unlimited: boolean; quantity: number }; // undefined = ilimitado (retrocompat)
  promoGift?: { buyQuantity: number; giftProductId: string; giftProductName: string; minOrderValueYen?: number };
}

export interface CartItem {
  product: Product;
  size: string;          // id da variante ('small'/'large' nos antigos, ou id custom)
  variantLabel?: string; // rótulo exibido (Pequeno, Kit...) — opcional p/ compatibilidade
  quantity: number;
  freeGift?: boolean;            // true = presente grátis adicionado automaticamente
  freeGiftFromProductId?: string; // produto que ativou o brinde
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
  paymentConfirmed?: boolean;            // true = admin confirmou pagamento recebido
  paymentConfirmedAt?: string;           // ISO timestamp da confirmação
  paymentConfirmedBy?: string;           // email do admin que confirmou
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
  minOrderValue?: number; // Valor mínimo do pedido em ¥ para usar o cupom
}
