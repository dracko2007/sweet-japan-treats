// Conteúdo editável do site (gerenciado pelo admin) salvo no Firestore.
// Hoje: vídeos promo da home. Leitura pública, escrita só admin (regras do Firestore).
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';

export interface HomeVideo {
  id: string;
  title: string;
  url: string; // link YouTube/Insta/TikTok
}

export interface HomeContent {
  videosTitle?: string;
  videosSubtitle?: string;
  videos: HomeVideo[];
}

const DEFAULT_HOME: HomeContent = {
  videosTitle: 'Opinião de Quem Recebeu',
  videosSubtitle: 'Veja vídeos reais de clientes recebendo e testando os produtos.',
  videos: [],
};

/* ----------------------------- Vlog ----------------------------- */
export interface VlogVideo {
  id: string;
  title: string;
  description?: string;
  url: string; // link do YouTube (ou ID)
  thumbnail?: string; // miniatura custom (opcional; senão usa a do YouTube)
  duration?: string;
  date?: string; // ISO (YYYY-MM-DD)
  views?: string;
}

export interface VlogContent {
  title?: string;
  subtitle?: string;
  featured?: VlogVideo | null; // vídeo principal (destaque)
  videos: VlogVideo[]; // vídeos secundários
}

const DEFAULT_VLOG: VlogContent = { featured: null, videos: [] };

export const siteContentService = {
  async getHome(): Promise<HomeContent> {
    if (!db) return DEFAULT_HOME;
    try {
      const snap = await getDoc(doc(db, 'siteContent', 'home'));
      if (!snap.exists()) return DEFAULT_HOME;
      const data = snap.data() as Partial<HomeContent>;
      return { ...DEFAULT_HOME, ...data, videos: data.videos || [] };
    } catch (e) {
      console.warn('siteContentService.getHome falhou:', e);
      return DEFAULT_HOME;
    }
  },

  async saveHome(content: HomeContent): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(
      doc(db, 'siteContent', 'home'),
      { ...content, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },

  async getVlog(): Promise<VlogContent> {
    if (!db) return DEFAULT_VLOG;
    try {
      const snap = await getDoc(doc(db, 'siteContent', 'vlog'));
      if (!snap.exists()) return DEFAULT_VLOG;
      const data = snap.data() as Partial<VlogContent>;
      return { ...DEFAULT_VLOG, ...data, videos: data.videos || [] };
    } catch (e) {
      console.warn('siteContentService.getVlog falhou:', e);
      return DEFAULT_VLOG;
    }
  },

  async saveVlog(content: VlogContent): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(
      doc(db, 'siteContent', 'vlog'),
      { ...content, featured: content.featured || null, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },
};
