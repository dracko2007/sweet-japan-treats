// Configuração centralizada do administrador.
// A autenticação usa Firebase Auth puro — a senha nunca é armazenada no bundle.

export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL ?? 'dracko2007@gmail.com';

export const ADMIN_USER_ID = 'admin-001';

/** Verdadeiro se o e-mail informado é o do administrador. */
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
