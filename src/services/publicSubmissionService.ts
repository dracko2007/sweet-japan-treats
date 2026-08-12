export type PublicSubmissionType =
  | 'custom_request'
  | 'b2b_request'
  | 'affiliate_request'
  | 'newsletter';

export interface PublicSubmissionResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function submitPublicForm<T extends object>(
  type: PublicSubmissionType,
  data: T,
): Promise<PublicSubmissionResult> {
  try {
    const endpoint = import.meta.env.DEV
      ? 'https://japanexpress-store.com/api/public-submission'
      : '/api/public-submission';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    return { ok: response.ok, status: response.status, error: payload.error };
  } catch {
    return { ok: false, status: 0, error: 'network_error' };
  }
}
