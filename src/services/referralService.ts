import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseSyncService } from '@/services/firebaseSyncService';

const REFERRAL_THRESHOLD_BRL = 3000; // amigo precisa gastar R$3000
const REFERRAL_REWARD_POINTS = 3000; // pontos para quem indicou

export const referralService = {
  // Gera o link de indicação do usuário
  getReferralLink(userId: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://japanexpress-store.com';
    return `${base}?ref=${userId}`;
  },

  // Lê o ref da URL e salva em sessionStorage para usar no cadastro
  captureReferral(): string | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) sessionStorage.setItem('jp_referral', ref);
    return ref || sessionStorage.getItem('jp_referral');
  },

  // Recupera o referral capturado (para usar no register)
  getPendingReferral(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('jp_referral');
  },

  clearPendingReferral(): void {
    if (typeof window !== 'undefined') sessionStorage.removeItem('jp_referral');
  },

  // Chamado após cadastro: vincula referredBy ao novo usuário
  async linkReferral(newUserId: string, referrerId: string): Promise<void> {
    if (!db || newUserId === referrerId) return;
    try {
      await firebaseSyncService.syncUserToFirestore(newUserId, {
        referredBy: referrerId,
        referredTotalBrl: 0,
        referralRewardPaid: false,
      } as any);
    } catch { /* silent */ }
  },

  // Chamado após cada compra confirmada do usuário
  // Acumula o gasto e verifica se atingiu o threshold para premiar quem indicou
  async onPurchaseCompleted(buyerId: string, amountBrl: number): Promise<void> {
    if (!db || amountBrl <= 0) return;
    try {
      const snap = await getDoc(doc(db, 'users', buyerId));
      const data = snap.data();
      if (!data?.referredBy || data?.referralRewardPaid) return;

      const referrerId: string = data.referredBy;
      const prevTotal: number = data.referredTotalBrl || 0;
      const newTotal = prevTotal + amountBrl;

      // Atualiza o total acumulado do indicado
      await updateDoc(doc(db, 'users', buyerId), {
        referredTotalBrl: newTotal,
      });

      if (newTotal < REFERRAL_THRESHOLD_BRL) return;

      // Atingiu o threshold — premia quem indicou
      await updateDoc(doc(db, 'users', buyerId), { referralRewardPaid: true });

      // Verifica se quem indicou é afiliado
      const referrerSnap = await getDoc(doc(db, 'users', referrerId));
      const referrerEmail: string = referrerSnap.data()?.email || '';

      let isAffiliate = false;
      if (referrerEmail && db) {
        try {
          const affQ = query(collection(db, 'affiliates'), where('ownerEmail', '==', referrerEmail.toLowerCase()));
          const affSnap = await getDocs(affQ);
          isAffiliate = !affSnap.empty;
        } catch { /* silent */ }
      }

      if (isAffiliate) {
        // Afiliado: registra comissão de 10% sobre o threshold (R$300)
        // A comissão é registrada manualmente no sistema de afiliados existente
        // Não concede pontos
        console.info(`[referral] Referrer ${referrerId} is affiliate — no points, commission tracked separately`);
      } else {
        // Cliente normal: concede 3000 pontos
        const currentPoints: number = referrerSnap.data()?.points || 0;
        await firebaseSyncService.syncUserToFirestore(referrerId, {
          points: currentPoints + REFERRAL_REWARD_POINTS,
        });
      }
    } catch (e) {
      console.warn('[referralService] onPurchaseCompleted error:', e);
    }
  },
};
