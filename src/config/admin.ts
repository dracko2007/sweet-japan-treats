// Configuração centralizada do administrador.
// A autenticação usa Firebase Auth puro — a senha nunca é armazenada no bundle.
//
// A conta administrativa é uma identidade fixa do Firebase Auth. A variável
// de ambiente pode sobrescrever o e-mail em instalações diferentes, mas a
// aplicação principal continua funcionando sem depender da Vercel.
export const ADMIN_EMAIL =
  String(import.meta.env.VITE_ADMIN_EMAIL || 'dracko2007@gmail.com').trim().toLowerCase();

export const ADMIN_USER_ID = 'admin-001';

/** Verdadeiro se o e-mail informado é o do administrador. */
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
