// Configurações de pagamento editáveis pelo admin (link Wise/Wisetag).
// Guardado em settings/payments — leitura pública, escrita só admin (regras).
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';

export interface PaymentSettings {
  wiseLink: string;     // link de cobrança Wise ou Wisetag (ex: https://wise.com/pay/me/...)
  wiseEnabled: boolean; // mostra a opção Wise no checkout
}

const DEFAULT: PaymentSettings = { wiseLink: '', wiseEnabled: false };

export const paymentSettingsService = {
  async get(): Promise<PaymentSettings> {
    if (!db) return DEFAULT;
    try {
      const snap = await getDoc(doc(db, 'settings', 'payments'));
      if (!snap.exists()) return DEFAULT;
      return { ...DEFAULT, ...(snap.data() as Partial<PaymentSettings>) };
    } catch (e) {
      console.warn('[payments] get falhou:', e);
      return DEFAULT;
    }
  },

  async save(settings: PaymentSettings): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(doc(db, 'settings', 'payments'), {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  },
};
