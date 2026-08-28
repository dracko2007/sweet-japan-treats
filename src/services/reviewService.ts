import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { Review, ProductRating } from '@/types/review';

const REVIEWS_COL = 'reviews';
const PRODUCTS_COL = 'products';

// Um review por usuário por produto — id determinístico evita duplicidade e
// permite que a regra do Firestore amarre a atualização do agregado
// rating/reviewCount do produto a uma criação genuína de review (ver
// firestore.rules: match /products/{productId}).
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

  // Grava a avaliação e, só quando é a primeira do usuário para este produto,
  // atualiza o agregado rating/reviewCount do produto — tudo numa transação
  // atômica (o Firestore garante que as duas escritas acontecem juntas ou
  // nenhuma acontece). A validação de compra real já rodou no servidor
  // (api/user-rewards.js claimProductReview) antes deste método ser chamado.
  async addReview(review: Omit<Review, 'id' | 'date'>): Promise<Review> {
    if (!db) throw new Error('Banco de dados indisponível. Tente novamente.');
    const reviewId = reviewDocId(review.productId, review.userId);
    const reviewRef = doc(db, REVIEWS_COL, reviewId);
    const productRef = doc(db, PRODUCTS_COL, review.productId);

    const newReview: Review = {
      ...review,
      id: reviewId,
      date: new Date().toISOString(),
    };

    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(reviewRef);
      if (existing.exists()) {
        throw new Error('already_reviewed');
      }
      const productSnap = await transaction.get(productRef);

      // Firestore client rejeita valores `undefined` — grava só os campos
      // opcionais realmente presentes (imagens/vídeo/pontos).
      const reviewDoc: Record<string, unknown> = {
        id: newReview.id,
        productId: newReview.productId,
        userId: newReview.userId,
        userName: newReview.userName,
        rating: newReview.rating,
        comment: newReview.comment,
        verified: newReview.verified,
        date: newReview.date,
      };
      if (newReview.images !== undefined) reviewDoc.images = newReview.images;
      if (newReview.videoUrl !== undefined) reviewDoc.videoUrl = newReview.videoUrl;
      if (newReview.pointsAwarded !== undefined) reviewDoc.pointsAwarded = newReview.pointsAwarded;
      transaction.set(reviewRef, reviewDoc);

      if (productSnap.exists()) {
        const data = productSnap.data();
        const prevCount = Number(data?.reviewCount) || 0;
        const prevRating = Number(data?.rating) || 0;
        const newCount = prevCount + 1;
        const newRating = (prevRating * prevCount + review.rating) / newCount;
        transaction.update(productRef, { rating: newRating, reviewCount: newCount });
      }
    });

    return newReview;
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
      await updateDoc(doc(db, PRODUCTS_COL, productId), { rating, reviewCount });
    } catch {
      // Produto pode ter sido removido — recontagem do agregado não é crítica.
    }
  },

  // Moderação: remove só as fotos de um review, mantendo nota e comentário.
  async updateReviewImages(reviewId: string, images: string[]): Promise<void> {
    if (!db) return;
    await ensureAdminAuth();
    await updateDoc(doc(db, REVIEWS_COL, reviewId), { images });
  },
};
