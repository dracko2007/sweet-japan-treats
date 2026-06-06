// Cliente do envio de e-mail (chama a função serverless /api/send-email,
// que usa o SMTP do Zoho no servidor). Falha de leve se não configurado.

async function send(payload: { to: string; type: 'welcome' | '2fa'; name?: string; code?: string }) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** E-mail de confirmação/boas-vindas no cadastro. */
export const sendConfirmationEmail = (to: string, name?: string) =>
  send({ to, type: 'welcome', name });

/** E-mail com código de verificação (2FA por e-mail). */
export const send2FACode = (to: string, code: string, name?: string) =>
  send({ to, type: '2fa', code, name });
