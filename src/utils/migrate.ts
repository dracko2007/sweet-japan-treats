/**
 * Migra chaves do localStorage da marca antiga (sweet-japan-*) para a nova (japan-express-*).
 * Chamado uma única vez no startup — se a chave nova já existe, não faz nada.
 */
export function migrateLocalStorage(): void {
  try {
    const PAIRS: [string, string][] = [
      ['sweet-japan-users', 'japan-express-users'],
      ['sweet-japan-coupons', 'japan-express-coupons'],
      ['sweet-japan-reviews', 'japan-express-reviews'],
    ];

    for (const [oldKey, newKey] of PAIRS) {
      if (localStorage.getItem(newKey) === null) {
        const oldValue = localStorage.getItem(oldKey);
        if (oldValue !== null) {
          localStorage.setItem(newKey, oldValue);
          localStorage.removeItem(oldKey);
        }
      }
    }

    // Wishlist é dinâmica (sufixo por e-mail): japan-express-wishlist_email
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sweet-japan-wishlist_')) {
        const newKey = key.replace('sweet-japan-wishlist_', 'japan-express-wishlist_');
        if (localStorage.getItem(newKey) === null) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            localStorage.setItem(newKey, value);
            localStorage.removeItem(key);
            i--; // ajusta índice após remoção
          }
        }
      }
    }
  } catch {
    // localStorage pode estar bloqueado em contextos privados — silencia
  }
}
