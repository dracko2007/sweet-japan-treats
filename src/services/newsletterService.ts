import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

export type LeadSource = 'exit_intent' | 'newsletter_footer' | 'guide' | 'cart_reminder';

export interface LeadCapture {
  email: string;
  source: LeadSource;
}

/**
 * Serviço de captura de leads (e-mails de quem ainda não comprou).
 * Idempotente por e-mail: se o lead já existe, apenas atualiza a origem e a
 * data — nunca duplica. Falhas de rede/Firestore são silenciosas para não
 * prejudicar a experiência de quem está preenchendo o formulário.
 */
class NewsletterService {
  async capture(lead: LeadCapture): Promise<boolean> {
    if (!db) {
      devWarn('⚠️ [NEWSLETTER] Firestore indisponível — lead não salvo na nuvem.');
      return false;
    }
    const email = lead.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;

    try {
      // Sanitiza o e-mail para virar um id de documento válido no Firestore.
      const ref = doc(db, 'newsletter', email.replace(/[.#$/[\]]/g, '_'));
      const existing = await getDoc(ref);
      await setDoc(
        ref,
        {
          email,
          source: lead.source,
          lastSource: lead.source,
          ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    } catch (err) {
      devWarn('⚠️ [NEWSLETTER] Falha ao salvar lead:', err);
      return false;
    }
  }
}

export const newsletterService = new NewsletterService();
