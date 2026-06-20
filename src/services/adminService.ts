// Administradores: login por e-mail (super-admin) ou NOME+senha (sub-admins no Firestore).
// Nível 1: vê/gerencia (sem deletar, sem financeiro, sem add admin).
// Nível 2: + deletar (sem financeiro/admin).  Nível 3: completo.
import { db, firebaseConfig } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { ADMIN_EMAIL } from '@/config/admin';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};

export type AdminRole = 1 | 2 | 3;

export interface AdminEntry {
  username: string;
  name: string;
  role: AdminRole;
  addedAt?: string;
  addedBy?: string;
}

const COL = 'admins';
const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

export const adminService = {
  async authenticate(identifier: string, password: string): Promise<AdminEntry | null> {
    // Super-admin: verifica via REST API (não dispara onAuthStateChanged do SDK,
    // evitando race condition onde o listener sobrescreve o estado admin).
    // UserContext.login() chama signInWithEmailAndPassword DEPOIS de salvar o estado.
    if (identifier.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      try {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password, returnSecureToken: true }),
          }
        );
        if (!res.ok) return null;
        return { username: ADMIN_EMAIL, name: 'Administrador', role: 3 };
      } catch {
        return null;
      }
    }
    // Sub-admins: login por nome/usuário com senha no Firestore
    if (!db) return null;
    const id = slug(identifier);
    try {
      const snap = await getDoc(doc(db, COL, id));
      if (snap.exists()) {
        const d = snap.data() as any;
        if (d.password === password) return { username: id, name: d.name || identifier, role: d.role };
      }
    } catch (e) {
      devWarn('[admin] authenticate falhou:', e);
    }
    return null;
  },

  async getAdmins(): Promise<AdminEntry[]> {
    const list: AdminEntry[] = [{ username: ADMIN_EMAIL, name: 'Administrador', role: 3, addedBy: 'sistema' }];
    if (!db) return list;
    try {
      await ensureAdminAuth();
      const snap = await getDocs(collection(db, COL));
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({ username: d.id, name: data.name, role: data.role, addedAt: data.addedAt, addedBy: data.addedBy });
      });
    } catch (e) {
      devWarn('[admin] getAdmins falhou:', e);
    }
    return list.sort((a, b) => b.role - a.role || a.name.localeCompare(b.name));
  },

  async addAdmin(name: string, password: string, role: AdminRole, addedBy?: string): Promise<{ ok: boolean; error?: string }> {
    if (!db) return { ok: false, error: 'Firebase indisponível' };
    const id = slug(name);
    if (!id) return { ok: false, error: 'Nome inválido' };
    if (!password || password.length < 8) return { ok: false, error: 'Senha muito curta (mín. 8 caracteres)' };
    try {
      await ensureAdminAuth();
      await setDoc(doc(db, COL, id), {
        name: name.trim(),
        password,
        role,
        addedAt: new Date().toISOString(),
        addedBy: addedBy || '',
      });
      return { ok: true };
    } catch (e: any) {
      devError('[admin] addAdmin falhou:', e);
      return { ok: false, error: e?.message };
    }
  },

  async removeAdmin(username: string): Promise<boolean> {
    if (!db) return false;
    if (username.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return false;
    const id = slug(username);
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, COL, id));
      return true;
    } catch (e) {
      devError('[admin] removeAdmin falhou:', e);
      return false;
    }
  },

  isSuper: (username?: string) =>
    !!username && username.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
};
