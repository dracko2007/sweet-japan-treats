// Sistema de pontos de fidelidade.
// Regras:
//  - 1 ponto por avaliação (nota 1–5 + comentário), 1 por produto, qualquer nota.
//  - Vídeo de review: 5 pontos por minuto (1 min = 5, 2 min = 10), 1 vídeo por produto,
//    liberado SÓ após o admin validar (pode mandar vídeo que não é review).
//  - 1 ponto a cada 100 ¥ gastos em produtos (sem contar o frete).
//  - Aniversário: 1000 pontos para a próxima compra.
//  - Resgate: 1 ponto = ¥1 de desconto.
import { db } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { safeStorage } from '@/utils/storage';
import { firebaseSyncService } from '@/services/firebaseSyncService';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


export const POINTS = {
  perReview: 1,
  perVideoMinute: 5,
  per100YenSpent: 1,
  birthday: 1000,
  yenPerPoint: 1,   // 1 ponto = ¥1 de desconto
  minRedeem: 1000,  // mínimo para resgatar
};

export type VideoReviewStatus = 'pending' | 'approved' | 'rejected';

export interface VideoReview {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  productId: string;
  productName: string;
  videoUrl: string;
  status: VideoReviewStatus;
  submittedAt: string;
  minutes?: number;       // preenchido pelo admin ao validar
  pointsAwarded?: number; // pontos concedidos na validação
}

const COL = 'video_reviews';
const LOCAL = 'jp_video_reviews';

/** Pontos pelo gasto em produtos (¥), sem frete. */
export const pointsForSpendYen = (yen: number): number =>
  Math.max(0, Math.floor((yen || 0) / 100) * POINTS.per100YenSpent);

/** Pontos por minutos de vídeo: 5 por minuto iniciado (mín. 1 min). */
export const pointsForVideoMinutes = (minutes: number): number => {
  const m = Math.max(1, Math.floor(minutes || 0));
  return m * POINTS.perVideoMinute;
};

function readLocal(): VideoReview[] {
  try { return JSON.parse(safeStorage.getItem(LOCAL) || '[]'); } catch { return []; }
}
function writeLocal(list: VideoReview[]) {
  safeStorage.setItem(LOCAL, JSON.stringify(list));
}

export const pointsService = {
  POINTS,

  /** Cliente envia um vídeo de review para validação (1 por produto). */
  async submitVideo(entry: Omit<VideoReview, 'id' | 'status' | 'submittedAt'>): Promise<{ ok: boolean; error?: string }> {
    const id = `vr-${entry.userId}-${entry.productId}`; // 1 por usuário+produto
    const rec: VideoReview = { ...entry, id, status: 'pending', submittedAt: new Date().toISOString() };
    // cache local
    const local = readLocal().filter((v) => v.id !== id);
    local.push(rec);
    writeLocal(local);
    if (!db) return { ok: true };
    try {
      await setDoc(doc(db, COL, id), rec);
      return { ok: true };
    } catch (e: any) {
      devWarn('[points] submitVideo falhou:', e);
      return { ok: false, error: e?.message };
    }
  },

  /** Já existe vídeo (pendente/aprovado) deste usuário para o produto? */
  async hasVideoForProduct(userId: string, productId: string): Promise<boolean> {
    const id = `vr-${userId}-${productId}`;
    if (readLocal().some((v) => v.id === id)) return true;
    if (!db) return false;
    try {
      const snap = await getDoc(doc(db, COL, id));
      return snap.exists();
    } catch { return false; }
  },

  /** Lista de vídeos (admin). */
  async getVideoReviews(): Promise<VideoReview[]> {
    if (!db) return readLocal();
    try {
      const snap = await getDocs(collection(db, COL));
      const list: VideoReview[] = [];
      snap.forEach((d) => list.push(d.data() as VideoReview));
      return list.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    } catch (e) {
      devWarn('[points] getVideoReviews falhou:', e);
      return readLocal();
    }
  },

  /** Admin aprova: concede pontos pela duração e marca como aprovado. */
  async approveVideo(v: VideoReview, minutes: number): Promise<{ ok: boolean; points: number; error?: string }> {
    const points = pointsForVideoMinutes(minutes);
    try {
      await this.awardPointsToUser(v.userId, points);
      if (db) {
        await updateDoc(doc(db, COL, v.id), { status: 'approved', minutes, pointsAwarded: points });
      }
      writeLocal(readLocal().map((x) => (x.id === v.id ? { ...x, status: 'approved', minutes, pointsAwarded: points } : x)));
      return { ok: true, points };
    } catch (e: any) {
      return { ok: false, points: 0, error: e?.message };
    }
  },

  /** Admin rejeita o vídeo (não concede pontos). */
  async rejectVideo(v: VideoReview): Promise<boolean> {
    try {
      if (db) await updateDoc(doc(db, COL, v.id), { status: 'rejected' });
      writeLocal(readLocal().map((x) => (x.id === v.id ? { ...x, status: 'rejected' } : x)));
      return true;
    } catch { return false; }
  },

  async removeVideo(id: string): Promise<boolean> {
    try {
      if (db) await deleteDoc(doc(db, COL, id));
      writeLocal(readLocal().filter((x) => x.id !== id));
      return true;
    } catch { return false; }
  },

  /** Soma pontos a um usuário específico (usado pelo admin) lendo/gravando no Firestore. */
  async awardPointsToUser(userId: string, amount: number): Promise<void> {
    if (!userId || amount <= 0) return;
    const current = await firebaseSyncService.getUserFromFirestore(userId);
    const newTotal = ((current?.points as number) || 0) + amount;
    await firebaseSyncService.syncUserToFirestore(userId, { points: newTotal });
  },
};
