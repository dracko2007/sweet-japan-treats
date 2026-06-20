// Configuração centralizada do administrador.
// VITE_ADMIN_EMAIL e VITE_ADMIN_PASSWORD devem ser definidos no Vercel/produção.
//
// ATENÇÃO ARQUITETURAL: VITE_ADMIN_PASSWORD é embutida no bundle do browser pelo Vite.
// Isso expõe a senha de admin para qualquer visitante via DevTools → Sources.
// Migração futura: mover autenticação admin para Firebase Auth puro (admin digita
// a senha no formulário; Firebase valida server-side; UID verificado no /admins).
// Por ora, use uma senha FORTE e única (não reutilizada em outros serviços).

export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL ?? 'dracko2007@gmail.com';

// TODO(security): remover quando migrar para Firebase Auth puro
export const ADMIN_PASSWORD: string = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

export const ADMIN_USER_ID = 'admin-001';

/** Verdadeiro se o e-mail informado é o do administrador. */
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
