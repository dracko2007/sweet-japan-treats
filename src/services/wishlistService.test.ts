// Favoritos vivem no Firestore: sobrevivem ao logout (que apaga a cópia local)
// e a nuvem manda sobre uma cópia local velha. Os favoritos da versão antiga,
// gravados no navegador por e-mail, migram uma única vez.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cloud: null as null | { items: unknown },
  setDoc: vi.fn(),
  auth: { currentUser: { uid: 'u1' } as null | { uid: string } },
}));

vi.mock('@/config/firebase', () => ({ db: {}, auth: mocks.auth }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  getDoc: vi.fn(async () => ({ exists: () => mocks.cloud !== null, data: () => mocks.cloud })),
  setDoc: mocks.setDoc,
  serverTimestamp: () => 'SERVER_TIME',
}));

import { wishlistService, type WishlistItem } from './wishlistService';

const item = (productId: string): WishlistItem => ({
  productId, productName: productId, productImage: '', productPrice: 100, addedAt: '2026-10-01T00:00:00.000Z',
});
const ids = (list: WishlistItem[]) => list.map((i) => i.productId);

describe('wishlistService', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.cloud = null;
    mocks.setDoc.mockReset().mockResolvedValue(undefined);
    mocks.auth.currentUser = { uid: 'u1' };
  });

  it('favoritar grava na nuvem do próprio usuário', () => {
    wishlistService.addToWishlist('u1', item('p1'));

    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = mocks.setDoc.mock.calls[0];
    expect(ref.path).toBe('wishlists/u1');
    expect(ids(data.items)).toEqual(['p1']);
  });

  it('não grava na nuvem de outra conta (sessão do Firebase diferente)', () => {
    mocks.auth.currentUser = { uid: 'outro' };
    wishlistService.addToWishlist('u1', item('p1'));

    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('depois do logout (cópia local apagada) a lista volta da nuvem', async () => {
    mocks.cloud = { items: [item('p1'), item('p2')] };

    await wishlistService.syncFromCloud('u1', 'u1@example.com');

    expect(ids(wishlistService.getWishlist('u1'))).toEqual(['p1', 'p2']);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('a nuvem manda: item removido em outro aparelho não ressuscita', async () => {
    localStorage.setItem('japan-express-wishlist_u1', JSON.stringify([item('p1'), item('removido')]));
    mocks.cloud = { items: [item('p1')] };

    await wishlistService.syncFromCloud('u1', 'u1@example.com');

    expect(ids(wishlistService.getWishlist('u1'))).toEqual(['p1']);
  });

  it('migra os favoritos antigos (por e-mail) uma vez e apaga a chave velha', async () => {
    localStorage.setItem('japan-express-wishlist_u1@example.com', JSON.stringify([item('antigo'), item('p1')]));
    mocks.cloud = { items: [item('p1')] };

    await wishlistService.syncFromCloud('u1', 'u1@example.com');

    expect(ids(wishlistService.getWishlist('u1'))).toEqual(['p1', 'antigo']);
    expect(localStorage.getItem('japan-express-wishlist_u1@example.com')).toBeNull();
    expect(ids(mocks.setDoc.mock.calls[0][1].items)).toEqual(['p1', 'antigo']);
  });

  it('ignora itens corrompidos vindos da nuvem', async () => {
    mocks.cloud = { items: [item('p1'), { productId: 7 }, 'lixo'] };

    await wishlistService.syncFromCloud('u1', 'u1@example.com');

    expect(ids(wishlistService.getWishlist('u1'))).toEqual(['p1']);
  });
});
