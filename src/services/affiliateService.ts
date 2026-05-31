// Serviço de afiliados/influencers.
// Um afiliado tem um CÓDIGO público e reutilizável que dá desconto ao comprador
// e credita uma comissão ao influencer sobre o valor líquido de cada venda.
// Armazenado no Firestore (collection "affiliates", id = código em maiúsculas)
// para funcionar entre dispositivos.

import { db } from '@/config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';

const COL = 'affiliates';
const PENDING_COL = 'affiliate_pending';

export interface PendingCommission {
  id: string;
  affiliateCode: string;
  netYen: number;          // valor líquido da venda (¥)
  commissionYen: number;   // comissão calculada (¥)
  orderId: string;
  buyerEmail: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

export interface Affiliate {
  code: string;            // código anunciado (ex: GANHA10)
  ownerName: string;       // nome do influencer
  ownerEmail: string;      // e-mail da conta do influencer (vê o painel)
  discountPercent: number; // desconto que o comprador ganha
  commissionPercent: number; // comissão do influencer sobre o valor líquido
  active: boolean;
  expiresAt: string;       // ISO
  createdAt: string;       // ISO
  // métricas acumuladas
  totalOrders: number;
  totalRevenue: number;    // soma do valor líquido das vendas
  totalEarnings: number;   // comissão acumulada
}

const normalize = (code: string) => code.trim().toUpperCase();

export const affiliateService = {
  /** Lista todos os afiliados (admin). */
  async getAll(): Promise<Affiliate[]> {
    if (!db) return [];
    try {
      const snap = await getDocs(collection(db, COL));
      return snap.docs.map((d) => d.data() as Affiliate);
    } catch (e) {
      console.warn('affiliateService.getAll falhou:', e);
      return [];
    }
  },

  /** Afiliados cujo dono é o e-mail dado (painel do influencer). */
  async getByOwnerEmail(email: string): Promise<Affiliate[]> {
    if (!db || !email) return [];
    try {
      const q = query(collection(db, COL), where('ownerEmail', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Affiliate);
    } catch (e) {
      console.warn('affiliateService.getByOwnerEmail falhou:', e);
      return [];
    }
  },

  /** Valida um código de afiliado (existe, ativo, não expirado). */
  async validate(code: string): Promise<{ valid: boolean; affiliate?: Affiliate; error?: string }> {
    if (!db) return { valid: false, error: 'Indisponível' };
    try {
      const ref = doc(db, COL, normalize(code));
      const snap = await getDoc(ref);
      if (!snap.exists()) return { valid: false, error: 'Código inválido.' };
      const aff = snap.data() as Affiliate;
      if (!aff.active) return { valid: false, error: 'Código inativo.' };
      if (new Date(aff.expiresAt) <= new Date()) return { valid: false, error: 'Código expirado.' };
      return { valid: true, affiliate: aff };
    } catch (e) {
      console.warn('affiliateService.validate falhou:', e);
      return { valid: false, error: 'Erro ao validar código.' };
    }
  },

  /** Cria ou atualiza um afiliado (admin). */
  async save(input: Omit<Affiliate, 'totalOrders' | 'totalRevenue' | 'totalEarnings' | 'createdAt'> & {
    createdAt?: string;
    totalOrders?: number;
    totalRevenue?: number;
    totalEarnings?: number;
  }): Promise<boolean> {
    if (!db) return false;
    try {
      await ensureAdminAuth();
      const code = normalize(input.code);
      const ref = doc(db, COL, code);
      const existing = await getDoc(ref);
      const prev = existing.exists() ? (existing.data() as Affiliate) : null;
      const affiliate: Affiliate = {
        code,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail.toLowerCase(),
        discountPercent: input.discountPercent,
        commissionPercent: input.commissionPercent,
        active: input.active,
        expiresAt: input.expiresAt,
        createdAt: prev?.createdAt || input.createdAt || new Date().toISOString(),
        totalOrders: prev?.totalOrders ?? 0,
        totalRevenue: prev?.totalRevenue ?? 0,
        totalEarnings: prev?.totalEarnings ?? 0,
      };
      await setDoc(ref, affiliate);
      return true;
    } catch (e) {
      console.error('affiliateService.save falhou:', e);
      return false;
    }
  },

  /** Remove um afiliado (admin). */
  async remove(code: string): Promise<boolean> {
    if (!db) return false;
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, COL, normalize(code)));
      return true;
    } catch (e) {
      console.error('affiliateService.remove falhou:', e);
      return false;
    }
  },

  /**
   * Credita uma venda ao afiliado: incrementa pedidos, receita líquida e a
   * comissão (valor líquido × commissionPercent).
   */
  async creditSale(code: string, netValue: number): Promise<void> {
    if (!db || !code) return;
    try {
      const ref = doc(db, COL, normalize(code));
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const aff = snap.data() as Affiliate;
      const earning = Math.round((netValue * (aff.commissionPercent || 0)) / 100);
      await setDoc(
        ref,
        {
          totalOrders: (aff.totalOrders || 0) + 1,
          totalRevenue: (aff.totalRevenue || 0) + netValue,
          totalEarnings: (aff.totalEarnings || 0) + earning,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('affiliateService.creditSale falhou:', e);
    }
  },

  /**
   * Registra uma comissão PENDENTE (na compra). Só vira comissão de verdade
   * quando o admin confirmar a entrega do pedido.
   */
  async addPendingCommission(params: {
    affiliateCode: string;
    netYen: number;
    orderId: string;
    buyerEmail: string;
  }): Promise<void> {
    if (!db || !params.affiliateCode) return;
    try {
      const code = normalize(params.affiliateCode);
      const affSnap = await getDoc(doc(db, COL, code));
      const commissionPercent = affSnap.exists() ? (affSnap.data() as Affiliate).commissionPercent || 0 : 0;
      const id = `${code}-${params.orderId || Date.now()}`;
      const record: PendingCommission = {
        id,
        affiliateCode: code,
        netYen: params.netYen,
        commissionYen: Math.round((params.netYen * commissionPercent) / 100),
        orderId: params.orderId || id,
        buyerEmail: params.buyerEmail || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, PENDING_COL, id), record);
    } catch (e) {
      console.warn('affiliateService.addPendingCommission falhou:', e);
    }
  },

  /** Lista comissões pendentes (admin). */
  async getPendingCommissions(): Promise<PendingCommission[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, PENDING_COL), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as PendingCommission);
    } catch (e) {
      console.warn('affiliateService.getPendingCommissions falhou:', e);
      return [];
    }
  },

  /** Comissões pendentes de um afiliado (painel do influencer). */
  async getPendingByCode(code: string): Promise<PendingCommission[]> {
    if (!db || !code) return [];
    try {
      const q = query(
        collection(db, PENDING_COL),
        where('affiliateCode', '==', normalize(code)),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as PendingCommission);
    } catch (e) {
      console.warn('affiliateService.getPendingByCode falhou:', e);
      return [];
    }
  },

  /** Confirma a entrega: credita a comissão ao afiliado e marca como confirmada. */
  async confirmPendingCommission(id: string): Promise<boolean> {
    if (!db || !id) return false;
    try {
      await ensureAdminAuth();
      const ref = doc(db, PENDING_COL, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return false;
      const pc = snap.data() as PendingCommission;
      if (pc.status === 'confirmed') return true;
      await affiliateService.creditSale(pc.affiliateCode, pc.netYen);
      await setDoc(ref, { status: 'confirmed' }, { merge: true });
      return true;
    } catch (e) {
      console.error('affiliateService.confirmPendingCommission falhou:', e);
      return false;
    }
  },

  /** Cancela uma comissão pendente (pedido cancelado). */
  async cancelPendingCommission(id: string): Promise<boolean> {
    if (!db || !id) return false;
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, PENDING_COL, id));
      return true;
    } catch (e) {
      console.error('affiliateService.cancelPendingCommission falhou:', e);
      return false;
    }
  },
};
