import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { safeStorage } from '@/utils/storage';

const devWarn = import.meta.env.DEV ? console.warn.bind(console) : () => {};

/**
 * Lista de desejos.
 *
 * Fonte da verdade: Firestore `wishlists/{uid}` — os favoritos sobrevivem ao
 * logout e aparecem em qualquer aparelho. O localStorage guarda só uma cópia
 * da sessão atual, para as telas lerem de forma síncrona; ela sai no logout
 * com o resto dos dados da conta (ver `purgeUserData`).
 */

export interface WishlistItem {
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  addedAt: string;
}

const CACHE_PREFIX = 'japan-express-wishlist';
const COLLECTION = 'wishlists';
/** Mesmo teto do `firestore.rules`. */
const MAX_ITEMS = 200;
/** Disparado quando a lista do usuário muda (inclusive vinda da nuvem). */
export const WISHLIST_CHANGED_EVENT = 'japan-express:wishlist';

function isWishlistItem(value: unknown): value is WishlistItem {
  return !!value && typeof value === 'object'
    && 'productId' in value && typeof value.productId === 'string'
    && 'productName' in value && typeof value.productName === 'string'
    && 'productImage' in value && typeof value.productImage === 'string'
    && 'productPrice' in value && typeof value.productPrice === 'number'
    && 'addedAt' in value && typeof value.addedAt === 'string';
}

function parseItems(value: unknown): WishlistItem[] {
  return Array.isArray(value) ? value.filter(isWishlistItem) : [];
}

function readCache(key: string): WishlistItem[] {
  try {
    return parseItems(JSON.parse(safeStorage.getItem(key) || '[]'));
  } catch {
    return [];
  }
}

/** Só grava na nuvem com a sessão do Firebase do PRÓPRIO usuário (admin usa id local). */
function cloudReady(userId: string): boolean {
  return !!db && auth?.currentUser?.uid === userId;
}

async function pushToCloud(userId: string, items: WishlistItem[]): Promise<void> {
  if (!db || !cloudReady(userId)) return;
  await setDoc(doc(db, COLLECTION, userId), { items, updatedAt: serverTimestamp() });
}

function save(userId: string, items: WishlistItem[]): void {
  safeStorage.setItem(`${CACHE_PREFIX}_${userId}`, JSON.stringify(items));
  window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT));
  pushToCloud(userId, items).catch((error) => devWarn('[wishlist] falha ao salvar na nuvem:', error));
}

export const wishlistService = {
  getWishlist: (userId: string): WishlistItem[] => readCache(`${CACHE_PREFIX}_${userId}`),

  /** Falso quando o produto já está na lista ou ela chegou ao limite. */
  addToWishlist: (userId: string, item: Omit<WishlistItem, 'addedAt'>): boolean => {
    const wishlist = wishlistService.getWishlist(userId);
    if (wishlist.length >= MAX_ITEMS || wishlist.some((w) => w.productId === item.productId)) return false;
    save(userId, [...wishlist, { ...item, addedAt: new Date().toISOString() }]);
    return true;
  },

  removeFromWishlist: (userId: string, productId: string): void => {
    save(userId, wishlistService.getWishlist(userId).filter((item) => item.productId !== productId));
  },

  isInWishlist: (userId: string, productId: string): boolean =>
    wishlistService.getWishlist(userId).some((item) => item.productId === productId),

  clearWishlist: (userId: string): void => {
    save(userId, []);
  },

  /**
   * Traz a lista da nuvem para a cópia local ao abrir a sessão. A nuvem manda:
   * a cópia local pode estar velha (removido em outro aparelho). Só entram de
   * fora os favoritos da versão antiga, que ficavam no navegador por e-mail —
   * migrados uma vez e apagados daqui.
   */
  syncFromCloud: async (userId: string, email: string): Promise<void> => {
    if (!db || !cloudReady(userId)) return;
    const snap = await getDoc(doc(db, COLLECTION, userId));
    const cloud = snap.exists() ? parseItems(snap.data().items) : [];
    const legacyKey = `${CACHE_PREFIX}_${email}`;
    const extras = [...readCache(legacyKey), ...(snap.exists() ? [] : wishlistService.getWishlist(userId))];

    const merged = [...cloud];
    for (const item of extras) {
      if (merged.length >= MAX_ITEMS) break;
      if (!merged.some((m) => m.productId === item.productId)) merged.push(item);
    }

    safeStorage.setItem(`${CACHE_PREFIX}_${userId}`, JSON.stringify(merged));
    safeStorage.removeItem(legacyKey);
    window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT));
    if (merged.length !== cloud.length) await pushToCloud(userId, merged);
  },
};
