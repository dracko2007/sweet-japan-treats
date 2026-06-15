// Configuração centralizada do administrador.
// VITE_ADMIN_EMAIL e VITE_ADMIN_PASSWORD devem ser definidos no Vercel/produção.

export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL ?? 'dracko2007@gmail.com';

// NUNCA usar string vazia como fallback — login sem senha seria aceito em produção
// se a variável de ambiente não estiver configurada.
export const ADMIN_PASSWORD: string = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

export const ADMIN_USER_ID = 'admin-001';

/** Verdadeiro se o e-mail informado é o do administrador. */
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
