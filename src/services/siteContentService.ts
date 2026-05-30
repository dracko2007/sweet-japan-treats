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
};
