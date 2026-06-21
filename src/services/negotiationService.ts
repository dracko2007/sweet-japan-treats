import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
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
    return onSnapshot(collection(db, COL), (snap) => {
      const negs = snap.docs.map((d) => d.data() as Negotiation);
      cb(negs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
  },

  listenByUser(userId: string, cb: (negs: Negotiation[]) => void): () => void {
    return onSnapshot(collection(db, COL), (snap) => {
      const negs = snap.docs
        .map((d) => d.data() as Negotiation)
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      cb(negs);
    });
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

  async getById(id: string): Promise<Negotiation | null> {
    const snap = await getDoc(doc(db, COL, id));
    return snap.exists() ? (snap.data() as Negotiation) : null;
  },

  isExpired(neg: Negotiation): boolean {
    return neg.status === 'pending' && new Date(neg.expiresAt) < new Date();
  },
};
