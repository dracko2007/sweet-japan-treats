import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  getDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Negotiation } from '@/types/negotiation';

const COL = 'negotiations';
const EXPIRY_HOURS = 24;

export const negotiationService = {
  async create(data: Omit<Negotiation, 'id' | 'createdAt' | 'expiresAt' | 'resolvedAt'>): Promise<Negotiation> {
    const ref = doc(collection(db, COL));
    const now = new Date();
    const expires = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
    const neg: Negotiation = {
      ...data,
      id: ref.id,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      resolvedAt: null,
    };
    await setDoc(ref, neg);
    return neg;
  },

  listenById(id: string, cb: (neg: Negotiation | null) => void): () => void {
    return onSnapshot(doc(db, COL, id), (snap) => {
      cb(snap.exists() ? (snap.data() as Negotiation) : null);
    });
  },

  listenAll(cb: (negs: Negotiation[]) => void): () => void {
    return onSnapshot(
      query(collection(db, COL), orderBy('createdAt', 'desc')),
      (snap) => cb(snap.docs.map((d) => d.data() as Negotiation)),
      (err) => console.error('[negotiations] listenAll error:', err)
    );
  },

  // userId pode ser o Firebase UID ou o email do usuário.
  // Sem orderBy para não exigir índice composto — ordena em JS.
  listenByUser(userId: string, cb: (negs: Negotiation[]) => void): () => void {
    const isEmail = userId.includes('@');
    // Quando userId é email, pode estar gravado em userEmail ou userId (legado)
    const field = isEmail ? 'userEmail' : 'userId';
    const q = query(collection(db, COL), where(field, '==', userId));
    return onSnapshot(
      q,
      (snap) => {
        const sorted = snap.docs
          .map(d => d.data() as Negotiation)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        cb(sorted);
      },
      (err) => console.error('[negotiations] listenByUser error:', err)
    );
  },

  async approve(id: string, approvedDiscountYen: number, adminNote: string, adminEmail: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      status: 'approved',
      approvedDiscountYen,
      adminNote,
      approvedBy: adminEmail,
      approvedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
      clientNotified: true,
    });
  },

  async reject(id: string, adminNote: string, adminEmail: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      status: 'rejected',
      approvedDiscountYen: null,
      adminNote,
      approvedBy: adminEmail,
      approvedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
      clientNotified: true,
    });
  },

  // Called client-side or by admin panel when expiresAt is past
  async expire(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      status: 'expired',
      resolvedAt: new Date().toISOString(),
      clientNotified: true,
    });
  },

  async markSeen(id: string): Promise<void> {
    await updateDoc(doc(db, COL, id), { clientSeen: true });
  },

  async markUsed(id: string, orderId: string): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      status: 'used',
      resolvedAt: new Date().toISOString(),
      clientSeen: true,
      usedInOrderId: orderId,
    });
  },

  async getById(id: string): Promise<Negotiation | null> {
    const snap = await getDoc(doc(db, COL, id));
    return snap.exists() ? (snap.data() as Negotiation) : null;
  },

  isExpired(neg: Negotiation): boolean {
    if (neg.status === 'used' || neg.status === 'rejected' || neg.status === 'expired') return false;
    return neg.status === 'pending' && new Date(neg.expiresAt) < new Date();
  },

  async deleteNegotiation(id: string): Promise<void> {
    await deleteDoc(doc(db, COL, id));
  },

  async deleteAllNegotiations(): Promise<void> {
    const snap = await getDocs(collection(db, COL));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  },

  async deleteNegotiationsByEmail(email: string): Promise<void> {
    const q = query(collection(db, COL), where('userEmail', '==', email));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  },
};
