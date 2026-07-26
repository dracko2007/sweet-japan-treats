import { authenticatedFetch } from '@/services/authenticatedFetch';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

type AccountMailType = 'welcome' | 'verify' | 'verify-admin';

async function send(to: string, type: AccountMailType, name?: string): Promise<boolean> {
  try {
    const response = await authenticatedFetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, name: name || '' }),
    });
    if (response.ok) return true;

    // O motivo importa e antes era descartado — só voltava `false`, então
    // ninguém sabia se o problema era credencial de SMTP ausente, permissão ou
    // o Firebase Admin. Os códigos que o servidor devolve:
    //   email_not_configured → falta NOREPLY_EMAIL_PASSWORD na Vercel
    //   forbidden            → o e-mail do pedido não é o da sessão
    //   internal_error       → normalmente Firebase Admin sem credencial,
    //                          quebrando generateEmailVerificationLink
    const detalhe = await response.json().catch(() => ({}));
    devWarn(`[EMAIL] /api/send-email falhou (${response.status}):`, detalhe?.error || '(sem código)');
    return false;
  } catch (error) {
    devWarn('[EMAIL] /api/send-email inacessível:', error);
    return false;
  }
}

export const sendConfirmationEmail = (to: string, name?: string): Promise<boolean> =>
  send(to, 'welcome', name);

export const sendVerificationEmail = (to: string, name?: string): Promise<boolean> =>
  send(to, 'verify', name);

/**
 * Reenvia a confirmação para um cliente já cadastrado, autenticando como admin.
 *
 * Não depende da sessão do cliente — que é justamente o que falha no caminho
 * normal e deixa a conta criada sem nenhum e-mail enviado, sem aviso a ninguém.
 */
export const resendVerificationAsAdmin = (to: string, name?: string): Promise<boolean> =>
  send(to, 'verify-admin', name);
