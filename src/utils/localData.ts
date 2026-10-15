import { safeStorage } from '@/utils/storage';

// O que sobrevive ao logout e à troca de usuário. Lista de PERMISSÃO: qualquer
// chave nova que alguém criar sai por padrão — dado de usuário não fica para
// trás por esquecimento.
//
// Ficam só coisas que não identificam ninguém: preferências do aparelho,
// caches públicos (iguais para todo visitante) e o estado interno do Firebase
// Auth. As fotos dos produtos não estão aqui porque vivem fora do
// localStorage: Cache Storage `product-images-v2` e IndexedDB `jp_catalog`.
const LOCAL_KEEP: Record<string, true> = {
  'preferred-language': true,
  'preferred-language-source': true,
  sakura_selected_country: true,
  cookie_consent: true,
  pwa_install_dismissed: true,
  thermalPrinter: true,
  whatsappServer: true,
  jp_maint: true,
  je_site_settings: true,
  fx_rates: true,
};
const SESSION_KEEP: Record<string, true> = { chunk_reload_at: true };
// O SDK do Auth pode cair para localStorage/sessionStorage quando o IndexedDB
// está bloqueado. Apagar essas chaves derrubaria a sessão de quem acabou de entrar.
const FIREBASE_PREFIX = 'firebase:';

// Dados que versões antigas gravavam e esta não grava mais, mas que continuam
// no disco de quem já usou a loja: o cache do service worker com respostas do
// Firestore e a persistência IndexedDB do SDK (documentos de usuário e pedidos).
const FIRESTORE_RESPONSE_CACHE = 'firestore-data';
const FIRESTORE_DB_PREFIX = 'firestore/';

export const SESSION_END_EVENT = 'japan-express:logout';

/** Apaga o que versões antigas gravavam do Firestore: cache do SW e IndexedDB. */
export async function deleteLegacyFirestoreData(projectId: string): Promise<void> {
  if (typeof caches !== 'undefined') void caches.delete(FIRESTORE_RESPONSE_CACHE).catch(() => false);
  if (typeof indexedDB === 'undefined') return;
  let names = [`${FIRESTORE_DB_PREFIX}[DEFAULT]/${projectId}/main`];
  try {
    if (typeof indexedDB.databases === 'function') {
      const found = (await indexedDB.databases())
        .map((d) => d.name)
        .filter((n): n is string => !!n && n.startsWith(FIRESTORE_DB_PREFIX));
      names = Array.from(new Set([...names, ...found]));
    }
  } catch { /* lista indisponível: fica o nome conhecido */ }
  for (const name of names) {
    try { indexedDB.deleteDatabase(name); } catch { /* bloqueado por outra aba */ }
  }
}

/** Id do usuário cuja sessão está gravada neste navegador, ou null. */
export function storedSessionUserId(): string | null {
  const raw = safeStorage.getItem('user');
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'id' in parsed && typeof parsed.id === 'string' && parsed.id) {
      return parsed.id;
    }
  } catch { /* sessão corrompida */ }
  return null;
}

/**
 * Remove do navegador todo dado de usuário/sessão e avisa os contextos para
 * zerarem o estado em memória (senão o próximo `setItem` regravaria tudo).
 * Mantém apenas `LOCAL_KEEP`, o Auth e as fotos/catálogo dos produtos. Os
 * restos do Firestore de versões antigas saem no boot (`deleteLegacyFirestoreData`).
 */
export function purgeUserData(): void {
  for (const key of safeStorage.keys()) {
    if (!Object.hasOwn(LOCAL_KEEP, key) && !key.startsWith(FIREBASE_PREFIX)) safeStorage.removeItem(key);
  }
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (!Object.hasOwn(SESSION_KEEP, key) && !key.startsWith(FIREBASE_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch { /* sessionStorage indisponível */ }
  window.dispatchEvent(new Event(SESSION_END_EVENT));
}
