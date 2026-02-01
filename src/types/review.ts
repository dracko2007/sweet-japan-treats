export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  images?: string[]; // URLs das fotos
  date: string;
  verified: boolean; // Comprou o produto
}

export interface ProductRating {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratings: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}
