import { auth } from '@/config/firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '@/config/admin';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

// Garante que o ADMIN está autenticado no Firebase antes de qualquer escrita.
// Cria a conta automaticamente se ainda não existir no Firebase Auth.
export async function ensureAdminAuth(): Promise<void> {
  if (!auth) return;
  if (auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;
  if (!ADMIN_PASSWORD) {
    devWarn('⚠️ ensureAdminAuth: VITE_ADMIN_PASSWORD não configurada.');
    return;
  }
  try {
    if (auth.currentUser) {
      try { await signOut(auth); } catch { /* ignore */ }
    }
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (e: any) {
    // Conta ainda não existe no Firebase Auth → cria agora
    if (e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential' || e?.code === 'auth/invalid-login-credentials') {
      try {
        await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      } catch (createErr) {
        devWarn('ensureAdminAuth: falha ao criar conta Firebase:', createErr);
      }
    } else {
      devWarn('ensureAdminAuth falhou:', e?.code, e?.message);
    }
  }
}
