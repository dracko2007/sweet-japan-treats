import { auth } from '@/config/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '@/config/admin';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

// Garante que o ADMIN está autenticado no Firebase antes de qualquer escrita
// que as regras de segurança exigem (pedidos, produtos, cupons...).
// Resolve sessões antigas/recém-carregadas e troca de usuário se preciso.
export async function ensureAdminAuth(): Promise<void> {
  if (!auth) return;
  // Já é o admin correto → ok.
  if (auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;
  if (!ADMIN_PASSWORD) {
    devWarn('⚠️ ensureAdminAuth: VITE_ADMIN_PASSWORD não está configurada — a escrita do admin vai falhar (Missing or insufficient permissions). Defina-a no Vercel.');
    return;
  }
  try {
    if (auth.currentUser) {
      try { await signOut(auth); } catch { /* ignore */ }
    }
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (e) {
    devWarn('ensureAdminAuth falhou (senha do Firebase ≠ VITE_ADMIN_PASSWORD?):', e);
  }
}
