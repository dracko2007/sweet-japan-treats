import { useSyncExternalStore } from 'react';
import { safeStorage } from '@/utils/storage';

/**
 * SANDBOX — alterna entre a navegação nova ("pro") e a original sem
 * recarregar. Persistido em localStorage para sobreviver às trocas de rota
 * (cada página monta o próprio <Layout>).
 */
export type NavVariant = 'pro' | 'original';

const KEY = 'sandbox_nav_variant';
const EVENT = 'sandbox-nav-variant';

const read = (): NavVariant => (safeStorage.getItem(KEY) === 'original' ? 'original' : 'pro');

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};

export const setNavVariant = (v: NavVariant) => {
  safeStorage.setItem(KEY, v);
  window.dispatchEvent(new Event(EVENT));
};

export const useNavVariant = (): NavVariant => useSyncExternalStore(subscribe, read, () => 'pro');
