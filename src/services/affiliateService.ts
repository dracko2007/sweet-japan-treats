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
  ownerEmail?: string;     // e-mail do dono do código (para regras de leitura)
  status: 'pending' | 'confirmed';
  createdAt: string;
}

export type AffiliateTier = 'bronze' | 'silver' | 'gold';

export const TIER_CONFIG: Record<AffiliateTier, {
  label: string;
  emoji: string;
  commissionPercent: number;
  goalYen: number;          // venda mensal mínima para subir/manter
  nextTier: AffiliateTier | null;
  prevTier: AffiliateTier | null;
}> = {
  bronze: { label: 'Bronze', emoji: '🥉', commissionPercent: 10, goalYen: 200_000, nextTier: 'silver', prevTier: null },
  silver: { label: 'Prata',  emoji: '🥈', commissionPercent: 15, goalYen: 500_000, nextTier: 'gold',   prevTier: 'bronze' },
  gold:   { label: 'Ouro',   emoji: '🥇', commissionPercent: 20, goalYen: 500_000, nextTier: null,     prevTier: 'silver' },
};

export interface Affiliate {
  code: string;
  ownerName: string;
  ownerEmail: string;
  discountPercent: number;
  commissionPercent: number;
  active: boolean;
  expiresAt: string;
  createdAt: string;
  // métricas acumuladas
  totalOrders: number;
  totalRevenue: number;
  totalEarnings: number;
  // sistema de níveis
  tier: AffiliateTier;             // nível atual
  currentMonthRevenue: number;     // vendas acumuladas no mês corrente (¥)
  currentMonthKey: string;         // "YYYY-MM" do mês sendo acumulado
  tierUpdatedAt?: string;          // quando o nível foi atualizado
}

const normalize = (code: string) => code.trim().toUpperCase();

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Calcula o próximo tier com base nas vendas do mês. */
function computeNextTier(_currentTier: AffiliateTier, monthRevenue: number): AffiliateTier {
  const { bronze, silver } = TIER_CONFIG;

  // < ¥200k → Bronze direto, independente do nível atual
  if (monthRevenue < bronze.goalYen) return 'bronze';

  // ≥ ¥500k → Ouro direto, independente do nível atual
  if (monthRevenue >= silver.goalYen) return 'gold';

  // ¥200k–¥499k → Prata
  return 'silver';
}

export const affiliateService = {
  /** Lista todos os afiliados (admin). */
  async getAll(): Promise<Affiliate[]> {
    if (!db) return [];
    try {
      const snap = await getDocs(collection(db, COL));
      // Usa o ID real do documento como `code` (fonte da verdade p/ deletar/editar)
      return snap.docs.map((d) => ({ ...(d.data() as Affiliate), code: d.id }));
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
      const tier: AffiliateTier = prev?.tier || 'bronze';
      const affiliate: Affiliate = {
        code,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail.toLowerCase(),
        discountPercent: input.discountPercent,
        commissionPercent: TIER_CONFIG[tier].commissionPercent, // sempre sincroniza com o tier
        active: input.active,
        expiresAt: input.expiresAt,
        createdAt: prev?.createdAt || input.createdAt || new Date().toISOString(),
        totalOrders: prev?.totalOrders ?? 0,
        totalRevenue: prev?.totalRevenue ?? 0,
        totalEarnings: prev?.totalEarnings ?? 0,
        tier,
        currentMonthRevenue: prev?.currentMonthRevenue ?? 0,
        currentMonthKey: prev?.currentMonthKey ?? monthKey(),
        tierUpdatedAt: prev?.tierUpdatedAt,
      };
      await setDoc(ref, affiliate);
      return true;
    } catch (e) {
      devError('affiliateService.save falhou:', e);
      return false;
    }
  },

  /** Remove um afiliado (admin). */
  async remove(code: string): Promise<{ ok: boolean; error?: string }> {
    if (!db) return { ok: false, error: 'Firebase indisponível' };
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, COL, normalize(code)));
      return { ok: true };
    } catch (e: any) {
      devError('affiliateService.remove falhou:', e);
      return { ok: false, error: e?.message || String(e) };
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

        const now = new Date();
        const mk = monthKey(now);
        const currentTier: AffiliateTier = aff.tier || 'bronze';

        // Virou o mês? Avalia tier com base no mês anterior e zera contador
        let tier = currentTier;
        let monthRevenue = (aff.currentMonthRevenue || 0) + netValue;
        if (aff.currentMonthKey && aff.currentMonthKey !== mk) {
          // Avalia com as vendas do mês anterior
          tier = computeNextTier(currentTier, aff.currentMonthRevenue || 0);
          monthRevenue = netValue; // zera e começa o novo mês com esta venda
        }

        const commissionPercent = TIER_CONFIG[tier].commissionPercent;
        const earning = Math.round((netValue * commissionPercent) / 100);

        tx.update(ref, {
          totalOrders: (aff.totalOrders || 0) + 1,
          totalRevenue: (aff.totalRevenue || 0) + netValue,
          totalEarnings: (aff.totalEarnings || 0) + earning,
          tier,
          commissionPercent,
          currentMonthRevenue: monthRevenue,
          currentMonthKey: mk,
          ...(tier !== currentTier ? { tierUpdatedAt: now.toISOString() } : {}),
        });
      });
    } catch (e) {
      devWarn('affiliateService.creditSale falhou:', e);
    }
  },

  /** Avalia e atualiza o tier de todos os afiliados (chamado pelo admin no virar do mês). */
  async evaluateAllTiers(): Promise<{ updated: number; errors: number }> {
    if (!db) return { updated: 0, errors: 0 };
    try {
      await ensureAdminAuth();
      const snap = await getDocs(collection(db, COL));
      let updated = 0, errors = 0;
      const mk = monthKey();
      await Promise.all(snap.docs.map(async (d) => {
        try {
          const aff = d.data() as Affiliate;
          const currentTier: AffiliateTier = aff.tier || 'bronze';
          const newTier = computeNextTier(currentTier, aff.currentMonthRevenue || 0);
          const commissionPercent = TIER_CONFIG[newTier].commissionPercent;
          await updateDoc(doc(db!, COL, d.id), {
            tier: newTier,
            commissionPercent,
            currentMonthRevenue: 0,
            currentMonthKey: mk,
            ...(newTier !== currentTier ? { tierUpdatedAt: new Date().toISOString() } : {}),
          });
          updated++;
        } catch { errors++; }
      }));
      return { updated, errors };
    } catch (e) {
      devError('evaluateAllTiers falhou:', e);
      return { updated: 0, errors: 1 };
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
      const ownerEmail = affSnap.exists() ? (affSnap.data() as Affiliate).ownerEmail || '' : '';
      const id = `${code}-${params.orderId || Date.now()}`;
      const record: PendingCommission = {
        id,
        affiliateCode: code,
        netYen: params.netYen,
        commissionYen: Math.round((params.netYen * commissionPercent) / 100),
        orderId: params.orderId || id,
        buyerEmail: params.buyerEmail || '',
        ownerEmail,
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
