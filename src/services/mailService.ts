import { authenticatedFetch } from '@/services/authenticatedFetch';

type AccountMailType = 'welcome' | 'verify';

async function send(to: string, type: AccountMailType, name?: string): Promise<boolean> {
  try {
    const response = await authenticatedFetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, name: name || '' }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const sendConfirmationEmail = (to: string, name?: string): Promise<boolean> =>
  send(to, 'welcome', name);

export const sendVerificationEmail = (to: string, name?: string): Promise<boolean> =>
  send(to, 'verify', name);
