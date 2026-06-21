export type NegotiationStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected';
export type NegotiationType = 'ps_fee' | 'shipping';

export interface CartItemSnapshot {
  productId: string;
  productName: string;
  productImage: string;
  size: string;
  variantLabel?: string;
  quantity: number;
  priceYen: number;
}

export interface Negotiation {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;

  cartItems: CartItemSnapshot[];
  checkoutForm: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building: string;
    country: string;
  };
  shipping: {
    carrier: string;
    cost: number;
    costYen: number;
    estimatedDays: string;
  } | null;
  deliveryTime: string;
  currency: string;

  type: NegotiationType;
  originalAmountYen: number;
  numUnits: number;

  requestedDiscountYen: number;
  clientNote: string;

  approvedDiscountYen: number | null;
  adminNote: string;

  status: NegotiationStatus;
  autoApproved: boolean;

  createdAt: string;
  resolvedAt: string | null;

  clientNotified: boolean;
  clientSeen: boolean;
}
