import { useEffect, useState } from 'react';
import { WISHLIST_CHANGED_EVENT, wishlistService, type WishlistItem } from '@/services/wishlistService';
import { SESSION_END_EVENT } from '@/utils/localData';

/**
 * Favoritos do usuário, atualizados quando a lista muda em qualquer tela,
 * quando a cópia da nuvem chega ao abrir a sessão e quando ela sai no logout.
 */
export function useWishlist(userId: string | undefined): WishlistItem[] {
  const [items, setItems] = useState<WishlistItem[]>(() => (userId ? wishlistService.getWishlist(userId) : []));

  useEffect(() => {
    const load = () => setItems(userId ? wishlistService.getWishlist(userId) : []);
    load();
    window.addEventListener(WISHLIST_CHANGED_EVENT, load);
    window.addEventListener(SESSION_END_EVENT, load);
    return () => {
      window.removeEventListener(WISHLIST_CHANGED_EVENT, load);
      window.removeEventListener(SESSION_END_EVENT, load);
    };
  }, [userId]);

  return items;
}
