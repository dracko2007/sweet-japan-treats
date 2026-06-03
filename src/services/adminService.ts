// Gestão de administradores e níveis de acesso.
// Nível 1: vê tudo, muda status, edita conteúdo — NÃO deleta, NÃO financeiro, NÃO add admin.
// Nível 2: tudo do 1 + DELETAR (menos financeiro) — ainda NÃO add admin.
// Nível 3: completo (financeiro + add/remover admins).
import { db } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { ADMIN_EMAIL } from '@/config/admin';

export type AdminRole = 1 | 2 | 3;

export interface AdminEntry {
  email: string;
  role: AdminRole;
  name?: string;
  addedAt?: string;
  addedBy?: string;
}

const COL = 'admins';
const norm = (e: string) => e.trim().toLowerCase();
const SUPER_ADMIN = norm(ADMIN_EMAIL);

export const adminService = {
  // Nível do e-mail. Super-admin sempre 3. Demais vêm do Firestore. 0 = não é admin.
  async getRole(email?: string | null): Promise<number> {
    if (!email) return 0;
    const e = norm(email);
    if (e === SUPER_ADMIN) return 3;
    if (!db) return 0;
    try {
      const snap = await getDoc(doc(db, COL, e));
      return snap.exists() ? Number((snap.data() as any).role) || 0 : 0;
    } catch (err) {
      console.warn('[admin] getRole falhou:', err);
      return 0;
    }
  },

  async getAdmins(): Promise<AdminEntry[]> {
    const list: AdminEntry[] = [
      { email: SUPER_ADMIN, role: 3, name: 'Super Admin', addedBy: 'sistema' },
    ];
    if (!db) return list;
    try {
      await ensureAdminAuth();
      const snap = await getDocs(collection(db, COL));
      snap.forEach((d) => {
        const data = d.data() as any;
        if (norm(d.id) !== SUPER_ADMIN) {
          list.push({ email: d.id, role: data.role, name: data.name, addedAt: data.addedAt, addedBy: data.addedBy });
        }
      });
    } catch (err) {
      console.warn('[admin] getAdmins falhou:', err);
    }
    return list.sort((a, b) => b.role - a.role || a.email.localeCompare(b.email));
  },

  async addAdmin(email: string, role: AdminRole, addedBy?: string, name?: string): Promise<boolean> {
    if (!db) return false;
    const e = norm(email);
    if (e === SUPER_ADMIN) return false; // super-admin é fixo
    try {
      await ensureAdminAuth();
      await setDoc(doc(db, COL, e), {
        email: e,
        role,
        name: name || '',
        addedAt: new Date().toISOString(),
        addedBy: addedBy || '',
      });
      return true;
    } catch (err) {
      console.error('[admin] addAdmin falhou:', err);
      return false;
    }
  },

  async removeAdmin(email: string): Promise<boolean> {
    if (!db) return false;
    const e = norm(email);
    if (e === SUPER_ADMIN) return false; // não dá pra remover o super-admin
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, COL, e));
      return true;
    } catch (err) {
      console.error('[admin] removeAdmin falhou:', err);
      return false;
    }
  },

  isSuperAdmin: (email?: string | null) => !!email && norm(email) === SUPER_ADMIN,
};
