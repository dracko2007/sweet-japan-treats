import { auth } from '@/config/firebase';

export async function firebaseIdToken(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sessão Firebase necessária. Entre novamente.');
  return user.getIdToken();
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await firebaseIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
