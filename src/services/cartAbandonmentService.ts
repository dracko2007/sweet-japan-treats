import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { safeStorage } from '@/utils/storage';

const LOCAL_KEY = 'abandoned_cart_local';
const FIRESTORE_COLL = 'abandoned_carts';
// Tempo mínimo para considerar um carrinho "abandonado" (1 hora).
const ABANDON_THRESHOLD_MS = 60 * 60 * 1000;

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};

interface AbandonedCartSnapshot {
  items: Array<{ productId: string; name: string; size: string; quantity: number }>;
  totalYen: number;
  itemCount: number;
  abandonedAt: number; // epoch ms
}

/**
 * Serviço de recuperação de carrinho abandonado.
 *
 * - REGISTRO: salva um snapshot leve (sem imagens/preços completos) no
 *   localStorage para visitantes e, se logado, também no Firestore por UID.
 * - RECUPERAÇÃO: ao retornar, se o carrinho foi abandonado há mais de 1h,
 *   devolve os dados para exibir um banner/lembrete.
 * - CONVERSÃO: limpa o registro quando o usuário finaliza ou esvazia o carrinho.
 *
 * Os e-mails de lembrete são enviados por um cron serverless (api/cart-recovery)
 * que lê os snapshots antigos do Firestore.
 */
class CartAbandonmentService {
  /** Salva/atualiza o snapshot do carrinho abandonado (chamado periodicamente). */
  async track(
    userId: string | null | undefined,
    items: Array<{ product: { id: string; name: string }; size: string; quantity: number }>,
    totalYen: number,
  ) {
    if (!items.length) {
      this.clear(userId);
      return;
    }
    const snapshot: AbandonedCartSnapshot = {
      items: items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        size: i.size,
        quantity: i.quantity,
      })),
      totalYen,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      abandonedAt: Date.now(),
    };

    // Sempre salva localmente (funciona para visitantes e logados).
    safeStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));

    // Logados: também grava na nuvem para o cron poder enviar e-mail.
    if (userId && db) {
      try {
        await setDoc(doc(db, FIRESTORE_COLL, userId), {
          ...snapshot,
          abandonedAt: snapshot.abandonedAt,
          updatedAt: serverTimestamp(),
          // Rearma o lembrete: o cron (api/cart-recovery) só envia para docs com
          // reminderSent === false. Sem este campo, a query never casa e nada é enviado.
          // Como abandonedAt volta a "agora" a cada atualização, o e-mail só dispara
          // quando o carrinho ficar realmente parado (>90min).
          reminderSent: false,
        }, { merge: true });
      } catch {
        /* silencioso — o localStorage já garante a recuperação client-side */
      }
    }
  }

  /** Retorna o carrinho abandonado se passou do threshold (ou null). */
  getAbandoned(): { items: AbandonedCartSnapshot['items']; itemCount: number; abandonedAt: number } | null {
    const raw = safeStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    try {
      const snap: AbandonedCartSnapshot = JSON.parse(raw);
      if (!snap.items?.length) return null;
      // Só conta como abandonado se passou do threshold E o carrinho atual está vazio
      // (se ainda tem itens, o usuário está ativamente comprando).
      const age = Date.now() - snap.abandonedAt;
      if (age < ABANDON_THRESHOLD_MS) return null;
      return { items: snap.items, itemCount: snap.itemCount, abandonedAt: snap.abandonedAt };
    } catch {
      return null;
    }
  }

  /** Limpa o registro de abandono (após conversão ou esvaziamento). */
  async clear(userId?: string | null) {
    safeStorage.removeItem(LOCAL_KEY);
    if (userId && db) {
      try {
        await deleteDoc(doc(db, FIRESTORE_COLL, userId));
      } catch {
        /* silencioso */
      }
    }
  }

  /** Marca como recuperado sem limpar o Firestore (cron cuida da remoção). */
  markRecovered() {
    safeStorage.removeItem(LOCAL_KEY);
    devLog('🛒 [CART RECOVERY] Carrinho recuperado pelo cliente');
  }
}

export const cartAbandonmentService = new CartAbandonmentService();
