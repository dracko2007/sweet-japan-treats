// Categorias de produto — todas editáveis/deletáveis, guardadas no Firestore.
// Na primeira vez são semeadas com a lista padrão; depois o admin controla tudo.
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface ProductCategory {
  id: string;
  label: string;
  icon: string;
}

// Lista inicial (semente). Depois de semeada, fica tudo no Firestore.
export const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: 'cosmeticos', label: 'Cosméticos', icon: '🧴' },
  { id: 'doces', label: 'Doces & Chás', icon: '🍵' },
  { id: 'acessorios', label: 'Acessórios', icon: '🎮' },
  { id: 'papelaria', label: 'Papelaria', icon: '✏️' },
  { id: 'eletronicos', label: 'Eletrônicos', icon: '📱' },
  { id: 'masculino', label: 'Masculino', icon: '👔' },
  { id: 'vestuario', label: 'Vestuário', icon: '👕' },
  { id: 'higiene', label: 'Higiene & Saúde', icon: '🧼' },
  { id: 'pet', label: 'Pet', icon: '🐕' },
];

const SETTINGS_DOC = 'product_categories';

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function readList(): Promise<ProductCategory[] | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
  if (!snap.exists()) return null;
  const list = snap.data().list;
  return Array.isArray(list) && list.length > 0 ? list : null;
}

async function writeList(list: ProductCategory[]): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'settings', SETTINGS_DOC), { list }, { merge: true });
}

export const categoryService = {
  /** Lista de categorias. Semeia com os padrões na primeira vez (best-effort). */
  async getAll(): Promise<ProductCategory[]> {
    if (!db) return DEFAULT_CATEGORIES;
    try {
      const list = await readList();
      if (list) return list;
      // Primeira vez: semeia (só funciona como admin; senão devolve os padrões)
      try { await writeList(DEFAULT_CATEGORIES); } catch { /* sem permissão (visitante) */ }
      return DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  },

  /** Adiciona uma categoria. Retorna a categoria criada. */
  async add(label: string, icon = '🏷️'): Promise<ProductCategory | null> {
    if (!db || !label.trim()) return null;
    const id = slugify(label);
    if (!id) return null;
    const newCat: ProductCategory = { id, label: label.trim(), icon: icon || '🏷️' };
    try {
      const list = (await readList()) || [...DEFAULT_CATEGORIES];
      if (list.some(c => c.id === id)) return newCat; // já existe
      await writeList([...list, newCat]);
      return newCat;
    } catch {
      return null;
    }
  },

  /** Edita label/emoji de qualquer categoria (mantém o id). */
  async update(id: string, label: string, icon: string): Promise<boolean> {
    if (!db || !label.trim()) return false;
    try {
      const list = (await readList()) || [...DEFAULT_CATEGORIES];
      const updated = list.map(c =>
        c.id === id ? { ...c, label: label.trim(), icon: icon.trim() || c.icon } : c
      );
      await writeList(updated);
      return true;
    } catch {
      return false;
    }
  },

  /** Remove qualquer categoria (mantém pelo menos 1). */
  async remove(id: string): Promise<boolean> {
    if (!db) return false;
    try {
      const list = (await readList()) || [...DEFAULT_CATEGORIES];
      const filtered = list.filter(c => c.id !== id);
      if (filtered.length === 0) return false; // não deixa zerar
      await writeList(filtered);
      return true;
    } catch {
      return false;
    }
  },

  /** Mantido por compatibilidade — agora todas as categorias são editáveis. */
  isDefault(_id: string): boolean {
    return false;
  },
};
