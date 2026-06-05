// Configuração centralizada do administrador.
// VITE_ADMIN_EMAIL e VITE_ADMIN_PASSWORD devem ser definidos no Vercel/produção.
// Sem eles, o login de admin via Firebase (super-admin) fica inativo.

export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL ?? 'dracko2007@gmail.com';

export const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD ?? '';

export const ADMIN_USER_ID = 'admin-001';

/** Verdadeiro se o e-mail informado é o do administrador. */
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
