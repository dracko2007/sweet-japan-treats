import { auth } from '@/config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '@/config/admin';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


// Garante que o admin está autenticado no Firebase antes de qualquer escrita
// que as regras de segurança exigem (pedidos, produtos, cupons...).
// Resolve sessões antigas/recém-carregadas em que o Firebase Auth ainda não subiu.
export async function ensureAdminAuth(): Promise<void> {
  if (!auth) return;
  if (auth.currentUser) return;
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (e) {
    devWarn('ensureAdminAuth falhou:', e);
  }
}
