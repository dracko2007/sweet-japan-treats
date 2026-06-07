// Client for the serverless /api/send-email endpoint, which sends through
// the store SMTP account on the server.

type MailType = 'welcome' | 'verify' | '2fa';

async function send(payload: { to: string; type: MailType; name?: string; code?: string }) {
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

export const sendConfirmationEmail = (to: string, name?: string) =>
  send({ to, type: 'welcome', name });

export const sendVerificationEmail = (to: string, name?: string) =>
  send({ to, type: 'verify', name });

export const send2FACode = (to: string, code: string, name?: string) =>
  send({ to, type: '2fa', code, name });
