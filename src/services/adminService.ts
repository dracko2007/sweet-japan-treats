// Administradores: login por USUÁRIO/NOME + senha (separado dos e-mails de cliente).
// Super-admin: usuário "Administrador" + senha do config. Demais ficam no Firestore.
// Nível 1: vê/gerencia (sem deletar, sem financeiro, sem add admin).
// Nível 2: + deletar (sem financeiro/admin).  Nível 3: completo.
import { db } from '@/config/firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';
import { ADMIN_PASSWORD } from '@/config/admin';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


export type AdminRole = 1 | 2 | 3;

export interface AdminEntry {
  username: string;   // identificador de login (normalizado)
  name: string;       // nome exibido
  role: AdminRole;
  addedAt?: string;
  addedBy?: string;
}

const COL = 'admins';
// Normaliza nome/usuário para virar o id do login (minúsculo, sem acento/espaços extras)
const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

const SUPER = 'administrador';

export const adminService = {
  // Confere usuário/nome + senha. Retorna o admin (com role) ou null.
  async authenticate(identifier: string, password: string): Promise<AdminEntry | null> {
    const id = slug(identifier);
    if (id === SUPER) {
      return password === ADMIN_PASSWORD ? { username: SUPER, name: 'Administrador', role: 3 } : null;
    }
    if (!db) return null;
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
    const list: AdminEntry[] = [{ username: SUPER, name: 'Administrador', role: 3, addedBy: 'sistema' }];
    if (!db) return list;
    try {
      await ensureAdminAuth();
      const snap = await getDocs(collection(db, COL));
      snap.forEach((d) => {
        const data = d.data() as any;
        if (d.id !== SUPER) list.push({ username: d.id, name: data.name, role: data.role, addedAt: data.addedAt, addedBy: data.addedBy });
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
    if (id === SUPER) return { ok: false, error: 'Nome reservado' };
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
    const id = slug(username);
    if (id === SUPER) return false;
    try {
      await ensureAdminAuth();
      await deleteDoc(doc(db, COL, id));
      return true;
    } catch (e) {
      devError('[admin] removeAdmin falhou:', e);
      return false;
    }
  },

  isSuper: (username?: string) => !!username && slug(username) === SUPER,
};
