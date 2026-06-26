/**
 * visitorService
 *
 * Rastreia visitantes únicos por sessão e salva no Firestore:
 * - Total de visitas por dia (analytics_daily/{YYYY-MM-DD})
 * - Contagem por país/cidade via ip-api.com (gratuito, sem chave)
 * - Páginas mais visitadas (analytics_pages/{slug})
 * - Produtos mais visualizados (analytics_products/{productId})
 *
 * Usado pelo painel admin em Dashboard → Visitantes.
 */

import { db } from '@/config/firebase';
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, query, orderBy, limit, getDocs,
} from 'firebase/firestore';

const SESSION_KEY = 'je_visitor_tracked';

// Páginas conhecidas (slug → label legível)
const PAGE_LABELS: Record<string, string> = {
  '/': 'Início',
  '/produtos': 'Catálogo de Produtos',
  '/carrinho': 'Carrinho',
  '/checkout': 'Checkout',
  '/frete': 'Frete',
  '/como-funciona': 'Como Funciona',
  '/empresas': 'Empresas (B2B)',
  '/sobre': 'Quem Somos',
  '/promocao': 'Promoção',
  '/perfil': 'Perfil',
  '/ofertas': 'Ofertas',
  '/afiliado': 'Afiliados',
};

export interface DailyStats {
  date: string;
  total: number;
  countries: Record<string, number>; // { 'BR': 42, 'PT': 8, ... }
  cities: Record<string, number>;    // { 'São Paulo': 20, ... }
}

export interface GeoInfo {
  country: string;      // 'Brazil'
  countryCode: string;  // 'BR'
  city: string;         // 'São Paulo'
  regionName: string;   // 'São Paulo'
}

async function getGeoInfo(): Promise<GeoInfo | null> {
  try {
    const res = await fetch('https://ip-api.com/json/?fields=country,countryCode,city,regionName', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'fail') return null;
    return data as GeoInfo;
  } catch {
    return null;
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export const visitorService = {
  /**
   * Registra uma visita (uma vez por sessão do browser).
   * Chamado no App.tsx na montagem inicial.
   */
  async trackVisit(): Promise<void> {
    if (!db) return;
    // Só rastreia uma vez por sessão (não por página)
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    const geo = await getGeoInfo();
    const dateKey = todayKey();
    const ref = doc(db, 'analytics_daily', dateKey);

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // Primeiro acesso do dia
        await setDoc(ref, {
          date: dateKey,
          total: 1,
          countries: geo ? { [geo.countryCode]: 1 } : {},
          cities: geo ? { [geo.city]: 1 } : {},
        });
      } else {
        // Incrementa total + país + cidade
        const updates: Record<string, unknown> = { total: increment(1) };
        if (geo) {
          updates[`countries.${geo.countryCode}`] = increment(1);
          if (geo.city) updates[`cities.${geo.city}`] = increment(1);
        }
        await updateDoc(ref, updates);
      }
    } catch {
      // silencioso — não interrompe a navegação
    }
  },

  /** Busca os últimos N dias de estatísticas. */
  async getRecentDays(days = 30): Promise<DailyStats[]> {
    if (!db) return [];
    try {
      const q = query(
        collection(db, 'analytics_daily'),
        orderBy('date', 'desc'),
        limit(days)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as DailyStats).reverse();
    } catch {
      return [];
    }
  },

  /**
   * Registra uma visualização de página.
   * Chamado no router a cada mudança de rota.
   */
  async trackPage(pathname: string): Promise<void> {
    if (!db) return;
    // Ignora rotas de admin e autenticação
    if (pathname.startsWith('/admin') || pathname.startsWith('/login')) return;
    try {
      const slug = pathname.startsWith('/produto/') ? '/produto/:id' : pathname;
      const label = PAGE_LABELS[slug] || slug;
      const ref = doc(db, 'analytics_pages', slug.replace(/\//g, '_').replace(/^_/, '') || 'home');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { slug, label, views: 1, updatedAt: new Date().toISOString() });
      } else {
        await updateDoc(ref, { views: increment(1), updatedAt: new Date().toISOString() });
      }
    } catch { /* silencioso */ }
  },

  /**
   * Registra uma visualização de produto.
   * Chamado na página /produto/:id.
   */
  async trackProduct(productId: string, productName: string): Promise<void> {
    if (!db) return;
    try {
      const ref = doc(db, 'analytics_products', productId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { productId, productName, views: 1, updatedAt: new Date().toISOString() });
      } else {
        await updateDoc(ref, {
          views: increment(1),
          productName, // atualiza o nome caso tenha mudado
          updatedAt: new Date().toISOString(),
        });
      }
    } catch { /* silencioso */ }
  },

  /** Top páginas mais visitadas. */
  async getTopPages(n = 10): Promise<Array<{ slug: string; label: string; views: number }>> {
    if (!db) return [];
    try {
      const q = query(collection(db, 'analytics_pages'), orderBy('views', 'desc'), limit(n));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as { slug: string; label: string; views: number });
    } catch { return []; }
  },

  /** Top produtos mais visualizados. */
  async getTopProducts(n = 10): Promise<Array<{ productId: string; productName: string; views: number }>> {
    if (!db) return [];
    try {
      const q = query(collection(db, 'analytics_products'), orderBy('views', 'desc'), limit(n));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as { productId: string; productName: string; views: number });
    } catch { return []; }
  },

  /** Agrega totais dos últimos N dias. */
  async getSummary(days = 30): Promise<{
    totalVisits: number;
    avgPerDay: number;
    topCountries: Array<{ code: string; count: number }>;
    topCities: Array<{ city: string; count: number }>;
    dailyData: DailyStats[];
  }> {
    const dailyData = await this.getRecentDays(days);
    const totalVisits = dailyData.reduce((s, d) => s + (d.total || 0), 0);
    const avgPerDay = dailyData.length > 0 ? Math.round(totalVisits / dailyData.length) : 0;

    // Agrega países
    const countryMap: Record<string, number> = {};
    const cityMap: Record<string, number> = {};
    dailyData.forEach(d => {
      Object.entries(d.countries || {}).forEach(([k, v]) => { countryMap[k] = (countryMap[k] || 0) + Number(v); });
      Object.entries(d.cities || {}).forEach(([k, v]) => { cityMap[k] = (cityMap[k] || 0) + Number(v); });
    });

    const topCountries = Object.entries(countryMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCities = Object.entries(cityMap)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { totalVisits, avgPerDay, topCountries, topCities, dailyData };
  },
};
