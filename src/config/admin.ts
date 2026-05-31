// Configuração centralizada do administrador.
// As credenciais vêm das variáveis de ambiente (VITE_ADMIN_*) quando definidas,
// com fallback para os valores padrão de demonstração. Para produção, defina
// VITE_ADMIN_EMAIL e VITE_ADMIN_PASSWORD no Vercel.

export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL || 'dracko2007@gmail.com';

export const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

export const ADMIN_USER_ID = 'admin-001';

/** Verdadeiro se o e-mail informado é o do administrador. */
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
