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
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};

const COL = 'affiliates';
const PENDING_COL = 'affiliate_pending';
const REQ_COL = 'affiliate_requests';

export interface AffiliateRequest {
  email: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  code?: string;     // preenchido quando aprovado
  message?: string;  // texto opcional do cliente (rede social, etc.)
}

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
      devWarn('affiliateService.getAll falhou:', e);
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
      devWarn('affiliateService.getByOwnerEmail falhou:', e);
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
      devWarn('affiliateService.validate falhou:', e);
      return { valid: false, error: 'Erro ao validar código.' };
    }
  },

  /* ---------- Solicitações para virar afiliado ---------- */

  /** Cliente solicita virar afiliado (1 por e-mail). */
  async requestAffiliate(name: string, email: string, message?: string): Promise<{ ok: boolean; error?: string }> {
    if (!db) return { ok: false, error: 'Indisponível' };
    const id = email.trim().toLowerCase();
    if (!id) return { ok: false, error: 'E-mail inválido' };
    try {
      await setDoc(doc(db, REQ_COL, id), {
        email: id,
        name: name || '',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        message: message || '',
      });
      return { ok: true };
    } catch (e: any) {
      devWarn('requestAffiliate falhou:', e);
      return { ok: false, error: e?.message };
    }
  },

  /** Status da solicitação de um cliente (ou null). */
  async getMyRequest(email: string): Promise<AffiliateRequest | null> {
    if (!db || !email) return null;
    try {
      const snap = await getDoc(doc(db, REQ_COL, email.trim().toLowerCase()));
      return snap.exists() ? (snap.data() as AffiliateRequest) : null;
    } catch { return null; }
  },

  /** Lista solicitações (admin), por padrão as pendentes. */
  async getRequests(status: 'pending' | 'approved' | 'rejected' = 'pending'): Promise<AffiliateRequest[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, REQ_COL), where('status', '==', status));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as AffiliateRequest)
        .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
    } catch (e) {
      devWarn('getRequests falhou:', e);
      return [];
    }
  },

  /** Admin aprova: cria o afiliado e marca a solicitação como aprovada. */
  async approveRequest(req: AffiliateRequest, opts: { code: string; discountPercent: number; commissionPercent: number; validityDays?: number }): Promise<{ ok: boolean; error?: string }> {
    if (!db) return { ok: false, error: 'Indisponível' };
    try {
      await ensureAdminAuth();
      const ok = await this.save({
        code: opts.code,
        ownerName: req.name,
        ownerEmail: req.email,
        discountPercent: opts.discountPercent,
        commissionPercent: opts.commissionPercent,
        active: true,
        expiresAt: new Date(Date.now() + (opts.validityDays || 365) * 86400000).toISOString(),
      });
      if (!ok) return { ok: false, error: 'Falha ao criar afiliado' };
      await updateDoc(doc(db, REQ_COL, req.email), { status: 'approved', code: opts.code.trim().toUpperCase() });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  },

  /** Admin recusa a solicitação. */
  async rejectRequest(email: string): Promise<boolean> {
    if (!db) return false;
    try {
      await ensureAdminAuth();
      await updateDoc(doc(db, REQ_COL, email.trim().toLowerCase()), { status: 'rejected' });
      return true;
    } catch { return false; }
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
      devError('affiliateService.save falhou:', e);
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
      devError('affiliateService.remove falhou:', e);
      return false;
    }
  },

  /**
   * Credita uma venda ao afiliado: incrementa pedidos, receita líquida e a
   * comissão (valor líquido × commissionPercent).
   */
  async creditSale(code: string, netValue: number): Promise<void> {
    if (!db || !code) return;
    const firestore = db;
    try {
      const ref = doc(firestore, COL, normalize(code));
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const aff = snap.data() as Affiliate;
        const earning = Math.round((netValue * (aff.commissionPercent || 0)) / 100);
        tx.update(ref, {
          totalOrders: (aff.totalOrders || 0) + 1,
          totalRevenue: (aff.totalRevenue || 0) + netValue,
          totalEarnings: (aff.totalEarnings || 0) + earning,
        });
      });
    } catch (e) {
      devWarn('affiliateService.creditSale falhou:', e);
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
      devWarn('affiliateService.addPendingCommission falhou:', e);
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
      devWarn('affiliateService.getPendingCommissions falhou:', e);
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
      devWarn('affiliateService.getPendingByCode falhou:', e);
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
      devError('affiliateService.confirmPendingCommission falhou:', e);
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
      devError('affiliateService.cancelPendingCommission falhou:', e);
      return false;
    }
  },
};
