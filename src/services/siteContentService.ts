// Conteúdo editável do site (gerenciado pelo admin) salvo no Firestore.
// Hoje: vídeos promo da home. Leitura pública, escrita só admin (regras do Firestore).
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


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
  saved?: boolean; // true quando o admin já salvou (mesmo vazio) → não recarrega padrões
}

const DEFAULT_VLOG: VlogContent = { featured: null, videos: [] };

// Sem vídeos de exemplo: o vlog só mostra o que o admin cadastrou e os reviews aprovados.
export const DEFAULT_VLOG_CONTENT: VlogContent = { featured: null, videos: [] };

/* ------------------------- Frete nacional (estoque local) ------------------------- */
/** PAC por região no Brasil; valor único nos outros países. Na moeda de cada país. */
export type LocalShippingTable = Record<string, { regions?: Record<string, number | undefined>; flat?: number }>;

/* ----------------------------- Settings ----------------------------- */
export interface SiteSettings {
  vlogEnabled: boolean;
}

const SETTINGS_LS = 'je_site_settings';
const DEFAULT_SETTINGS: SiteSettings = { vlogEnabled: false };

export const siteContentService = {
  async getSettings(): Promise<SiteSettings> {
    try {
      const cached = localStorage.getItem(SETTINGS_LS);
      if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    } catch {}
    if (!db) return DEFAULT_SETTINGS;
    try {
      const snap = await getDoc(doc(db, 'siteContent', 'settings'));
      const data = snap.exists() ? (snap.data() as Partial<SiteSettings>) : {};
      const result = { ...DEFAULT_SETTINGS, ...data };
      try { localStorage.setItem(SETTINGS_LS, JSON.stringify(result)); } catch {}
      return result;
    } catch (e) {
      devWarn('getSettings falhou:', e);
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: SiteSettings): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(doc(db, 'siteContent', 'settings'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
    try { localStorage.setItem(SETTINGS_LS, JSON.stringify(settings)); } catch {}
  },


  async getHome(): Promise<HomeContent> {
    if (!db) return DEFAULT_HOME;
    try {
      const snap = await getDoc(doc(db, 'siteContent', 'home'));
      if (!snap.exists()) return DEFAULT_HOME;
      const data = snap.data() as Partial<HomeContent>;
      return { ...DEFAULT_HOME, ...data, videos: data.videos || [] };
    } catch (e) {
      devWarn('siteContentService.getHome falhou:', e);
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
      return { ...DEFAULT_VLOG, ...data, videos: data.videos || [], saved: true };
    } catch (e) {
      devWarn('siteContentService.getVlog falhou:', e);
      return DEFAULT_VLOG;
    }
  },

  /** Tabela do frete nacional (pública: o checkout mostra o valor antes da cotação do servidor). */
  async getLocalShipping(): Promise<LocalShippingTable> {
    if (!db) return {};
    try {
      const snap = await getDoc(doc(db, 'siteContent', 'localShipping'));
      const { updatedAt: _ignored, ...table } = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      return table as LocalShippingTable;
    } catch (e) {
      devWarn('siteContentService.getLocalShipping falhou:', e);
      return {};
    }
  },

  async saveLocalShipping(table: LocalShippingTable): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    // JSON tira os `undefined` (campo apagado no formulário), que o Firestore recusa.
    const clean = JSON.parse(JSON.stringify(table)) as LocalShippingTable;
    await setDoc(doc(db, 'siteContent', 'localShipping'), { ...clean, updatedAt: serverTimestamp() });
  },

  async saveVlog(content: VlogContent): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(
      doc(db, 'siteContent', 'vlog'),
      { ...content, featured: content.featured || null, saved: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },
};
