import { auth } from '@/config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const ADMIN_EMAIL = 'dracko2007@gmail.com';
const ADMIN_PASSWORD = 'admin123';

// Garante que o admin está autenticado no Firebase antes de qualquer escrita
// que as regras de segurança exigem (pedidos, produtos, cupons...).
// Resolve sessões antigas/recém-carregadas em que o Firebase Auth ainda não subiu.
export async function ensureAdminAuth(): Promise<void> {
  if (!auth) return;
  if (auth.currentUser) return;
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (e) {
    console.warn('ensureAdminAuth falhou:', e);
  }
}
