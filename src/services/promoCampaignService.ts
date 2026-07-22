// Campanhas promocionais (notificação por e-mail/push): criação (admin),
// validação pública por código (qualquer visitante resgata) e controle de uso
// por CPF (anti-abuso: 1 resgate por CPF, como o cupom de afiliado).
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';
import type { PromoCampaign } from '@/types/promoCampaign';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};

const COL = 'promo_campaigns';
const USAGE = 'promo_usage';

// Normaliza um código de resgate (lockstep em create/validate/hasUsed/recordUsage).
const norm = (code: string) => (code || '').trim().toUpperCase();

export const promoCampaignService = {
  /** Admin: cria a campanha (doc id = código minúsculo). Idempotente. */
  async create(c: PromoCampaign): Promise<void> {
    if (!db) return;
    await ensureAdminAuth();
    const id = norm(c.code).toLowerCase();
    // O SDK client do Firestore rejeita campos undefined (o Admin SDK os ignora) —
    // removemos antes de gravar para não abortar a criação da campanha.
    const payload = Object.fromEntries(
      Object.entries({ ...c, code: norm(c.code) }).filter(([, v]) => v !== undefined)
    );
    await setDoc(doc(db, COL, id), payload);
    devLog('[promoCampaign] criada:', c.code, c.mechanic);
  },

  /** Validação pública: ativa e não expirada. */
  async validate(code: string): Promise<{ valid: boolean; campaign?: PromoCampaign; error?: string }> {
    if (!db) return { valid: false, error: 'Firestore indisponível' };
    try {
      const snap = await getDoc(doc(db, COL, norm(code).toLowerCase()));
      if (!snap.exists()) return { valid: false, error: 'Código de promoção inválido' };
      const c = snap.data() as PromoCampaign;
      if (!c.active) return { valid: false, error: 'Promoção inativa' };
      if (c.expiresAt && c.expiresAt < Date.now()) return { valid: false, error: 'Promoção expirada' };
      return { valid: true, campaign: c };
    } catch (e) {
      devWarn('[promoCampaign] validate falhou:', e instanceof Error ? e.message : e);
      return { valid: false, error: 'Não foi possível validar a promoção' };
    }
  },

  /** Limite por CPF: já resgatou esta campanha? */
  async hasUsed(code: string, cpfRaw: string): Promise<boolean> {
    if (!db) return false;
    const cpf = (cpfRaw || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    try {
      const snap = await getDoc(doc(db, USAGE, `${norm(code)}_${cpf}`));
      return snap.exists();
    } catch {
      return false;
    }
  },

  /** Registra o uso (idempotente) — chamado no checkout ao confirmar o pedido. */
  async recordUsage(code: string, cpfRaw: string, email: string, orderId: string): Promise<void> {
    if (!db) return;
    const cpf = (cpfRaw || '').replace(/\D/g, '');
    if (cpf.length !== 11) return;
    try {
      await setDoc(doc(db, USAGE, `${norm(code)}_${cpf}`), {
        code: norm(code), cpf, email: email || '', orderId, usedAt: Date.now(),
      });
    } catch (e) {
      devWarn('[promoCampaign] recordUsage falhou:', e instanceof Error ? e.message : e);
    }
  },
};
