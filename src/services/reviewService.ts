import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { Review, ProductRating } from '@/types/review';

const REVIEWS_COL = 'reviews';
const PRODUCTS_COL = 'products';

// Um review por usuário por produto, com id determinístico. Quem grava é o
// servidor (api/user-rewards.js, ação `product-review`): ele confere a compra
// e recalcula a nota do produto. Aqui ficam a leitura e a moderação do admin.
const reviewDocId = (productId: string, userId: string) => `${productId}_${userId}`;

const emptyRating = (productId: string): ProductRating => ({
  productId,
  averageRating: 0,
  totalReviews: 0,
  ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
});

export const reviewService = {
  // Todas as avaliações (usado pela moderação do admin).
  async getAllReviews(): Promise<Review[]> {
    if (!db) return [];
    const snap = await getDocs(collection(db, REVIEWS_COL));
    return snap.docs.map((d) => d.data() as Review);
  },

  // Avaliações de um produto — mais recentes primeiro.
  async getProductReviews(productId: string): Promise<Review[]> {
    if (!db) return [];
    const q = query(collection(db, REVIEWS_COL), where('productId', '==', productId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as Review)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  // Calcula o rating médio + distribuição por estrela de um produto a partir
  // das avaliações reais (mesma lógica de antes, só que lendo do Firestore).
  async getProductRating(productId: string): Promise<ProductRating> {
    const reviews = await this.getProductReviews(productId);
    if (reviews.length === 0) return emptyRating(productId);

    const ratings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;
    reviews.forEach((review) => {
      ratings[review.rating as keyof typeof ratings]++;
      totalRating += review.rating;
    });

    return {
      productId,
      averageRating: totalRating / reviews.length,
      totalReviews: reviews.length,
      ratings,
    };
  },

  // Usuário pode avaliar se está logado e ainda não tem review deste produto.
  async canUserReview(userId: string, productId: string): Promise<boolean> {
    if (!userId || !db) return false;
    const snap = await getDoc(doc(db, REVIEWS_COL, reviewDocId(productId, userId)));
    return !snap.exists();
  },

  // Exclusão pelo admin (moderação): apaga o review e recalcula o agregado do
  // produto a partir das avaliações restantes.
  async deleteReview(reviewId: string): Promise<void> {
    if (!db) return;
    await ensureAdminAuth();
    const reviewRef = doc(db, REVIEWS_COL, reviewId);
    const snap = await getDoc(reviewRef);
    const productId = snap.exists() ? (snap.data() as Review).productId : null;

    await deleteDoc(reviewRef);
    if (!productId) return;

    const remaining = await this.getProductReviews(productId);
    const reviewCount = remaining.length;
    const rating = reviewCount > 0
      ? remaining.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;
    try {
      // `updatedAt` leva a nota nova a quem já tem o catálogo em cache.
      await updateDoc(doc(db, PRODUCTS_COL, productId), { rating, reviewCount, updatedAt: serverTimestamp() });
    } catch {
      // Produto pode ter sido removido — recontagem do agregado não é crítica.
    }
  },

  // Ação em massa do admin: apaga TODAS as avaliações e zera o agregado
  // rating/reviewCount de cada produto avaliado — o mesmo resultado que
  // deleteReview grava quando não sobra nenhuma avaliação do produto.
  // Retorna quantas avaliações foram apagadas.
  async deleteAllReviews(): Promise<number> {
    if (!db) throw new Error('Banco de dados indisponível. Tente novamente.');
    await ensureAdminAuth();
    const snap = await getDocs(collection(db, REVIEWS_COL));
    const productIds = new Set(snap.docs.map((d) => (d.data() as Review).productId).filter(Boolean));

    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    // Produto pode ter sido removido — recontagem do agregado não é crítica.
    await Promise.allSettled(
      [...productIds].map((productId) => updateDoc(doc(db, PRODUCTS_COL, productId), {
        rating: 0,
        reviewCount: 0,
        updatedAt: serverTimestamp(),
      }))
    );
    return snap.size;
  },

  // Moderação: remove só as fotos de um review, mantendo nota e comentário.
  async updateReviewImages(reviewId: string, images: string[]): Promise<void> {
    if (!db) return;
    await ensureAdminAuth();
    await updateDoc(doc(db, REVIEWS_COL, reviewId), { images });
  },
};
