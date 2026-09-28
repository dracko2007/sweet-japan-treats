import { auth } from '@/config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN_EMAIL } from '@/config/admin';

// Confere a senha do admin antes de ações de nível 2 (ver ConfirmDialog).
// Verifica via Firebase Auth — sem senha no bundle.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password || !auth) return false;
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    return true;
  } catch {
    return false;
  }
}
