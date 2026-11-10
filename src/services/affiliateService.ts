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
import { submitPublicForm } from '@/services/publicSubmissionService';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { safeStorage } from '@/utils/storage';

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
  bronze: { label: 'Bronze', emoji: '🥉', commissionPercent: 10, goalYen: 100_000, nextTier: 'silver', prevTier: null },
  silver: { label: 'Prata',  emoji: '🥈', commissionPercent: 15, goalYen: 200_000, nextTier: 'gold',   prevTier: 'bronze' },
  gold:   { label: 'Ouro',   emoji: '🥇', commissionPercent: 20, goalYen: 201_000, nextTier: null,     prevTier: 'silver' },
};

const computeNextTier = (tier: AffiliateTier, revenue: number): AffiliateTier => {
  const next = TIER_CONFIG[tier].nextTier;
  return next && revenue >= TIER_CONFIG[next].goalYen ? next : tier;
};

/**
 * 'affiliate' = afiliado: comissão por venda, com metas e níveis.
 * 'promoter'  = divulgador: recebe o produto grátis e divulga; sem comissão nem meta.
 *               Cada código é de um produto/vídeo e medimos o retorno dele (visitas e compras).
 */
export type AffiliateKind = 'affiliate' | 'promoter';

export const SITE_URL = 'https://japanexpress-store.com';

/** Link divulgado: direto no produto quando o código é de um produto específico. */
export const affiliateLink = (code: string, productId?: string) =>
  productId ? `${SITE_URL}/produto/${productId}?ref=${code}` : `${SITE_URL}/?ref=${code}`;

export interface Affiliate {
  code: string;
  kind?: AffiliateKind;       // ausente = 'affiliate' (cadastros antigos)
  productId?: string;         // divulgador: produto enviado
  productName?: string;
  visitCount?: number;        // pessoas que chegaram pelo link ou digitaram o código
  linkVisits?: number;
  codeVisits?: number;
  ownerName: string;
  ownerEmail: string;
  discountPercent: number;
  commissionPercent: number;
  active: boolean;
  expiresAt: string;
  createdAt: string;
  totalOrders: number;
  totalRevenue: number;
  totalEarnings: number;
  tier: AffiliateTier;
  currentMonthRevenue: number;
  currentMonthKey: string;
  tierUpdatedAt?: string;
  tierSettings?: AffiliateTierSettings;
}

/** O que o servidor devolve ao validar um código no carrinho. */
export type AffiliateCouponInfo = Pick<Affiliate, 'code' | 'ownerName' | 'discountPercent' | 'expiresAt' | 'kind'>;

export interface AffiliateTierSettings {
  bronzeGoalYen: number;
  bronzePercent: number;
  silverGoalYen: number;
  silverPercent: number;
  goldGoalYen: number;
  goldPercent: number;
}

export type AffiliateDashboard = Pick<
  Affiliate,
  | 'code'
  | 'discountPercent'
  | 'commissionPercent'
  | 'active'
  | 'expiresAt'
  | 'totalOrders'
  | 'totalRevenue'
  | 'totalEarnings'
  | 'tier'
  | 'currentMonthRevenue'
  | 'tierSettings'
  | 'kind'
  | 'productId'
  | 'productName'
  | 'visitCount'
  | 'linkVisits'
  | 'codeVisits'
>;
export type PendingCommissionSummary = Pick<
  PendingCommission,
  'id' | 'affiliateCode' | 'netYen' | 'commissionYen'
>;

/** Vídeo de review enviado por um divulgador (YouTube, TikTok ou Instagram). */
export type ReviewPlatform = 'youtube' | 'tiktok' | 'instagram';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'unavailable';
export interface AffiliateReview {
  id: string;
  code: string;
  productId: string;
  productName: string;
  ownerName: string;
  platform: ReviewPlatform;
  videoId: string;
  url: string;
  title: string;
  thumbnail: string;
  status: ReviewStatus;
  createdAt: string;
  ownerEmail?: string; // só na lista do admin
}

/** Compras pagas (e não canceladas) de um código de divulgador. */
export interface PromoterOrder {
  date: string;
  netYen: number;
  orderId?: string;      // só para o admin
  customerName?: string; // só para o admin
}
export interface PromoterOrders {
  count: number;
  revenueYen: number;
  orders: PromoterOrder[];
}

const REVIEW_ERRORS: Record<string, string> = {
  invalid_review_url: 'Link não reconhecido. Use o link do vídeo no YouTube, TikTok ou Instagram.',
  review_already_sent: 'Este vídeo já foi enviado para este código.',
  forbidden: 'Este código não pertence à sua conta.',
  rate_limited: 'Muitos envios seguidos. Tente de novo mais tarde.',
};

async function reviewsCall<T>(body: Record<string, unknown>, signedIn = true): Promise<T> {
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await (signedIn ? authenticatedFetch('/api/affiliates', init) : fetch('/api/affiliates', init));
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(REVIEW_ERRORS[payload.error || ''] || 'Não foi possível concluir. Tente de novo.');
  return payload;
}

const normalize = (code: string) => code.trim().toUpperCase();

export const isPromoter = (affiliate: { kind?: AffiliateKind }) => affiliate.kind === 'promoter';

/** Id anônimo do navegador: o servidor conta cada visitante uma vez por código. */
function visitorId(): string {
  const key = 'je_visitor_id';
  let id = safeStorage.getItem(key);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = crypto.randomUUID();
    safeStorage.setItem(key, id);
  }
  return id;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Mantém o nível se a meta anterior foi atingida; caso contrário recalcula o nível. */
function tierForRevenue(revenue: number, settings?: AffiliateTierSettings): AffiliateTier {
  const bronzeGoal = settings?.bronzeGoalYen ?? TIER_CONFIG.bronze.goalYen;
  const silverGoal = settings?.silverGoalYen ?? TIER_CONFIG.silver.goalYen;
  return revenue <= bronzeGoal ? 'bronze' : revenue <= silverGoal ? 'silver' : 'gold';
}

export const affiliateService = {
  /** Lista todos os afiliados (admin) e inicia o novo ciclo mensal. */
  async getAll(): Promise<Affiliate[]> {
    if (!db) return [];
    try {
      const snap = await getDocs(collection(db, COL));
      const mk = monthKey();
      await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as Affiliate;
        if (isPromoter(data)) return; // divulgador não tem ciclo de metas
        if (data.currentMonthKey && data.currentMonthKey !== mk) {
          const previousRevenue = Number(data.currentMonthRevenue || 0);
          const nextTier = tierForRevenue(previousRevenue, data.tierSettings);
          const settings = data.tierSettings;
          const commissionPercent = nextTier === 'bronze'
            ? (settings?.bronzePercent ?? TIER_CONFIG.bronze.commissionPercent)
            : nextTier === 'silver'
              ? (settings?.silverPercent ?? TIER_CONFIG.silver.commissionPercent)
              : (settings?.goldPercent ?? TIER_CONFIG.gold.commissionPercent);
          await updateDoc(doc(db!, COL, d.id), {
            tier: nextTier,
            commissionPercent,
            currentMonthRevenue: 0,
            currentMonthKey: mk,
            tierUpdatedAt: new Date().toISOString(),
          });
        }
      }));
      const refreshed = await getDocs(collection(db, COL));
      return refreshed.docs.map((d) => ({ ...(d.data() as Affiliate), code: d.id }));
    } catch (e) {
      devWarn('affiliateService.getAll falhou:', e);
      return [];
    }
  },

  /** Afiliados cujo dono é o e-mail dado (painel do influencer). */
  async getByOwnerEmail(email: string): Promise<AffiliateDashboard[]> {
    if (!email) return [];
    try {
      const response = await authenticatedFetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'by-owner',
          ownerEmail: email.trim().toLowerCase(),
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const payload = await response.json() as { affiliates?: AffiliateDashboard[] };
      return Array.isArray(payload.affiliates) ? payload.affiliates : [];
    } catch (e) {
      devWarn('affiliateService.getByOwnerEmail falhou:', e);
      return [];
    }
  },

  /**
   * Valida um código de afiliado (existe, ativo, não expirado) pelo servidor.
   * Só volta o que o carrinho mostra; e-mail e ganhos do afiliado ficam no servidor.
   */
  async validate(code: string, signedIn = false): Promise<{ valid: boolean; affiliate?: AffiliateCouponInfo; error?: string }> {
    const errors: Record<string, string> = { not_found: 'Código inválido.', inactive: 'Código inativo.', expired: 'Código expirado.' };
    try {
      const request = signedIn ? authenticatedFetch : fetch;
      const response = await request('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', code: normalize(code) }),
      });
      if (response.status === 400) return { valid: false, error: errors.not_found };
      if (!response.ok) throw new Error(`status ${response.status}`);
      const payload = await response.json() as { valid?: boolean; reason?: string; affiliate?: AffiliateCouponInfo };
      if (payload.valid === true && payload.affiliate) return { valid: true, affiliate: payload.affiliate };
      return { valid: false, error: errors[payload.reason || ''] || errors.not_found };
    } catch (e) {
      devWarn('affiliateService.validate falhou:', e);
      return { valid: false, error: 'Erro ao validar código.' };
    }
  },

  /**
   * Registra que alguém chegou por um código (abriu o link ou digitou no carrinho).
   * É a base da contagem de retorno do divulgador. Nunca atrapalha a navegação.
   */
  async trackVisit(code: string, source: 'link' | 'code'): Promise<void> {
    const normalized = normalize(code);
    if (!normalized) return;
    const sentKey = `affiliate_visit_${normalized}`;
    if (safeStorage.getItem(sentKey)) return;
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track-visit', code: normalized, source, visitorId: visitorId() }),
    };
    try {
      // Com conta, o servidor conta por pessoa (uid); sem conta, por navegador.
      const response = await authenticatedFetch('/api/affiliates', init).catch(() => fetch('/api/affiliates', init));
      if (response.ok) safeStorage.setItem(sentKey, '1');
    } catch (e) {
      devWarn('affiliateService.trackVisit falhou:', e);
    }
  },

  /* ---------- Reviews (vídeos) dos divulgadores ---------- */

  /** Divulgador envia o link do vídeo de um código dele; entra como pendente de aprovação. */
  async submitReview(code: string, url: string): Promise<{ ok: true; review: AffiliateReview } | { ok: false; error: string }> {
    try {
      const { review } = await reviewsCall<{ review: AffiliateReview }>({ action: 'review-submit', code: normalize(code), url: url.trim() });
      return { ok: true, review };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Não foi possível enviar.' };
    }
  },

  /** Reviews enviados pela conta logada. */
  async getMyReviews(): Promise<AffiliateReview[]> {
    try {
      return (await reviewsCall<{ reviews: AffiliateReview[] }>({ action: 'review-mine' })).reviews || [];
    } catch (e) {
      devWarn('affiliateService.getMyReviews falhou:', e);
      return [];
    }
  },

  /** Reviews aprovados (público): todos para o vlog, ou só os de um produto. */
  async getApprovedReviews(productId?: string): Promise<AffiliateReview[]> {
    try {
      const body = { action: 'review-list', ...(productId ? { productId } : {}) };
      return (await reviewsCall<{ reviews: AffiliateReview[] }>(body, false)).reviews || [];
    } catch (e) {
      devWarn('affiliateService.getApprovedReviews falhou:', e);
      return [];
    }
  },

  /** Todos os reviews (admin). */
  async getAllReviews(): Promise<AffiliateReview[]> {
    try {
      return (await reviewsCall<{ reviews: AffiliateReview[] }>({ action: 'review-admin-list' })).reviews || [];
    } catch (e) {
      devWarn('affiliateService.getAllReviews falhou:', e);
      return [];
    }
  },

  /** Confere se os vídeos aprovados ainda existem nas redes; os que saíram do ar somem do site. */
  async checkReviews(): Promise<{ checked: number; hidden: number; restored: number } | null> {
    try {
      return await reviewsCall<{ checked: number; hidden: number; restored: number }>({ action: 'review-check' });
    } catch (e) {
      devWarn('affiliateService.checkReviews falhou:', e);
      return null;
    }
  },

  /** Compras por código de divulgador, contadas nos pedidos (cancelado não conta). */
  async getPromoterOrders(admin = false): Promise<Record<string, PromoterOrders>> {
    try {
      const body = { action: 'promoter-orders', ...(admin ? { admin: true } : {}) };
      return (await reviewsCall<{ orders: Record<string, PromoterOrders> }>(body)).orders || {};
    } catch (e) {
      devWarn('affiliateService.getPromoterOrders falhou:', e);
      return {};
    }
  },

  /** Admin aprova, recusa ou exclui um review. */
  async moderateReview(id: string, status: 'approved' | 'rejected' | 'deleted'): Promise<boolean> {
    try {
      await reviewsCall<{ ok: boolean }>({ action: 'review-moderate', id, status });
      return true;
    } catch (e) {
      devWarn('affiliateService.moderateReview falhou:', e);
      return false;
    }
  },

  /* ---------- Solicitações para virar afiliado ---------- */

  /** Cliente solicita virar afiliado (1 por e-mail). */
  async requestAffiliate(name: string, email: string, message?: string): Promise<{ ok: boolean; error?: string }> {
    const result = await submitPublicForm('affiliate_request', { name, email, message });
    return result.ok
      ? { ok: true }
      : { ok: false, error: result.error === 'already_requested' ? 'Solicitação já enviada.' : 'Não foi possível enviar a solicitação.' };
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
      const code = normalize(opts.code);
      const ref = doc(db, COL, code);
      const existing = await getDoc(ref);
      const previous = existing.exists() ? existing.data() as Affiliate : null;
      const now = new Date().toISOString();
      await setDoc(ref, {
        code,
        ownerName: req.name,
        ownerEmail: req.email.trim().toLowerCase(),
        discountPercent: opts.discountPercent,
        commissionPercent: opts.commissionPercent,
        active: true,
        expiresAt: new Date(Date.now() + (opts.validityDays || 365) * 86400000).toISOString(),
        createdAt: previous?.createdAt || now,
        totalOrders: previous?.totalOrders || 0,
        totalRevenue: previous?.totalRevenue || 0,
        totalEarnings: previous?.totalEarnings || 0,
        tier: previous?.tier || 'bronze',
        currentMonthRevenue: previous?.currentMonthRevenue || 0,
        currentMonthKey: previous?.currentMonthKey || monthKey(),
        tierSettings: previous?.tierSettings || {
          bronzeGoalYen: 100000, bronzePercent: opts.commissionPercent,
          silverGoalYen: 200000, silverPercent: 15,
          goldGoalYen: 201000, goldPercent: 20,
        },
      });
      await updateDoc(doc(db, REQ_COL, req.email.trim().toLowerCase()), { status: 'approved', code });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
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
  async save(input: Omit<
    Affiliate,
    'totalOrders' | 'totalRevenue' | 'totalEarnings' | 'createdAt'
    | 'tier' | 'currentMonthRevenue' | 'currentMonthKey' | 'tierUpdatedAt'
    | 'visitCount' | 'linkVisits' | 'codeVisits'
  > & {
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
      const kind: AffiliateKind = input.kind === 'promoter' ? 'promoter' : 'affiliate';
      const affiliate: Affiliate = {
        code,
        kind,
        ...(input.productId ? { productId: input.productId, productName: input.productName || '' } : {}),
        // Contagem de retorno: o formulário nunca zera.
        visitCount: prev?.visitCount ?? 0,
        linkVisits: prev?.linkVisits ?? 0,
        codeVisits: prev?.codeVisits ?? 0,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail.toLowerCase(),
        discountPercent: input.discountPercent,
        commissionPercent: kind === 'promoter' ? 0 : input.commissionPercent,
        active: input.active,
        expiresAt: input.expiresAt,
        createdAt: prev?.createdAt || input.createdAt || new Date().toISOString(),
        totalOrders: prev?.totalOrders ?? 0,
        totalRevenue: prev?.totalRevenue ?? 0,
        totalEarnings: prev?.totalEarnings ?? 0,
        tier,
        currentMonthRevenue: prev?.currentMonthRevenue ?? 0,
        currentMonthKey: prev?.currentMonthKey ?? monthKey(),
        ...(prev?.tierUpdatedAt ? { tierUpdatedAt: prev.tierUpdatedAt } : {}),
        ...(kind === 'affiliate' && (input.tierSettings || prev?.tierSettings) ? { tierSettings: input.tierSettings || prev?.tierSettings } : {}),
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
      const ref = doc(db, COL, normalize(code));
      const affiliateSnap = await getDoc(ref);
      await deleteDoc(ref);
      if (affiliateSnap.exists()) {
        const ownerEmail = String((affiliateSnap.data() as Affiliate).ownerEmail || '').trim().toLowerCase();
        if (ownerEmail) {
          const requests = await getDocs(query(collection(db, REQ_COL), where('email', '==', ownerEmail)));
          await Promise.all(requests.docs.map((request) => deleteDoc(request.ref)));
          await deleteDoc(doc(db, REQ_COL, ownerEmail));
        }
      }
      return { ok: true };
    } catch (e) {
      devError('affiliateService.remove falhou:', e);
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
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
        const settings = aff.tierSettings;
        const tierConfig = settings ? {
          bronze: { commissionPercent: settings.bronzePercent, goalYen: settings.bronzeGoalYen },
          silver: { commissionPercent: settings.silverPercent, goalYen: settings.silverGoalYen },
          gold: { commissionPercent: settings.goldPercent, goalYen: settings.goldGoalYen },
        } : TIER_CONFIG;
        const tierForRevenue = (revenue: number): AffiliateTier =>
          revenue <= tierConfig.bronze.goalYen ? 'bronze' :
          revenue <= tierConfig.silver.goalYen ? 'silver' : 'gold';
        let tier = currentTier;
        let monthRevenue = (aff.currentMonthRevenue || 0) + netValue;
        if (aff.currentMonthKey && aff.currentMonthKey !== mk) {
          tier = tierForRevenue(aff.currentMonthRevenue || 0);
          monthRevenue = netValue;
        }

        const commissionPercent = tierConfig[tier].commissionPercent;
        const earning = Math.round((netValue * commissionPercent) / 100);

        tx.update(ref, {
          totalOrders: (aff.totalOrders || 0) + 1,
          totalRevenue: (aff.totalRevenue || 0) + netValue,
          totalEarnings: (aff.totalEarnings || 0) + earning,
          tier,
          commissionPercent,
          currentMonthRevenue: monthRevenue,
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
          if (isPromoter(aff)) return;
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

  /** Zera o ciclo mensal e retorna todos os afiliados ao Bronze. */
  async resetAllAffiliates(): Promise<{ updated: number; errors: number }> {
    if (!db) return { updated: 0, errors: 0 };
    try {
      await ensureAdminAuth();
      const snap = await getDocs(collection(db, COL));
      let updated = 0;
      let errors = 0;
      const mk = monthKey();
      await Promise.all(snap.docs.map(async (d) => {
        try {
          if (isPromoter(d.data() as Affiliate)) return;
          await updateDoc(doc(db!, COL, d.id), {
            tier: 'bronze',
            commissionPercent: TIER_CONFIG.bronze.commissionPercent,
            currentMonthRevenue: 0,
            currentMonthKey: mk,
            tierUpdatedAt: new Date().toISOString(),
          });
          updated++;
        } catch {
          errors++;
        }
      }));
      return { updated, errors };
    } catch (e) {
      devError('resetAllAffiliates falhou:', e);
      return { updated: 0, errors: 1 };
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
  async getPendingByCode(code: string): Promise<PendingCommissionSummary[]> {
    if (!code) return [];
    try {
      const response = await authenticatedFetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pending-by-code',
          code: normalize(code),
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const payload = await response.json() as { pending?: PendingCommissionSummary[] };
      return Array.isArray(payload.pending) ? payload.pending : [];
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
