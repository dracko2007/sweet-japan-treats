// Sorteio da loja (gerenciado pelo admin) salvo no Firestore.
// Documento único `raffles/active` — mesmo formato de doc fixo usado em siteContentService.
// Leitura pública, escrita só admin (regras do Firestore).
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, getDocs, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ensureAdminAuth } from '@/utils/adminAuth';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

const RAFFLE_DOC = 'active';
const COL = 'raffles';

export interface RafflePrize {
  rank: number;                 // posição no pódio, começa em 1
  type: 'product' | 'points';
  productId?: string;
  productName?: string;
  productImage?: string;
  productUrl?: string;          // rota interna do produto (/produto/:id)
  points?: number;
}

export interface RaffleWinner {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  // Snapshot do "segue a loja" no momento do sorteio. Não impede ganhar —
  // serve só para o admin cobrar depois quem ainda não segue.
  followsInstagram: boolean;
  followsTiktok: boolean;
}

export interface Raffle {
  rules: string;
  prizeCount: number;
  prizes: RafflePrize[];
  winners: RaffleWinner[];
  drawnAt: string | null;
  published: boolean;
}

export interface RaffleParticipant {
  id: string;
  name: string;
  email: string;
  followsInstagram: boolean;
  followsTiktok: boolean;
}

const DEFAULT_RAFFLE: Raffle = {
  rules: '',
  prizeCount: 3,
  prizes: [],
  winners: [],
  drawnAt: null,
  published: false,
};

// O doc pode ter sido gravado por uma versão anterior sem alguns campos;
// normaliza sempre para o shape completo antes de entregar à UI.
// Valida e normaliza dados vindos do Firestore. snap.data() é unknown,
// então buscamos os campos conhecidos com type guards mínimos.
const normalize = (data: unknown): Raffle => {
  if (!data || typeof data !== 'object') return DEFAULT_RAFFLE;
  const record = data as Record<string, unknown>;
  
  const rules = typeof record.rules === 'string' ? record.rules : '';
  const prizeCount = typeof record.prizeCount === 'number' ? record.prizeCount : 3;
  const prizes = Array.isArray(record.prizes) ? record.prizes : [];
  const winners = Array.isArray(record.winners) ? record.winners : [];
  const drawnAt = typeof record.drawnAt === 'string' ? record.drawnAt : null;
  const published = Boolean(record.published);
  
  return { rules, prizeCount, prizes: prizes as RafflePrize[], winners: winners as RaffleWinner[], drawnAt, published };
};

export const raffleService = {
  async getRaffle(): Promise<Raffle> {
    if (!db) return DEFAULT_RAFFLE;
    try {
      const snap = await getDoc(doc(db, COL, RAFFLE_DOC));
      if (!snap.exists()) return DEFAULT_RAFFLE;
      return normalize(snap.data());
    } catch (e) {
      devWarn('raffleService.getRaffle falhou:', e);
      return DEFAULT_RAFFLE;
    }
  },

  // Listener em tempo real (mesmo padrão de negotiationService.listenById).
  //
  // `onError` não é opcional por capricho: sem ele, quem chama fica preso no
  // estado de "carregando" quando o Firestore recusa a leitura (regra não
  // publicada, rede caída), porque o callback de sucesso nunca roda. Em
  // produção o `devWarn` é no-op, então a tela trava sem nem um log.
  subscribe(cb: (raffle: Raffle) => void, onError?: (err: unknown) => void): () => void {
    if (!db) {
      onError?.(new Error('Firebase indisponível'));
      return () => undefined;
    }
    return onSnapshot(
      doc(db, COL, RAFFLE_DOC),
      (snap) => cb(snap.exists() ? normalize(snap.data()) : DEFAULT_RAFFLE),
      (err) => {
        devWarn('raffleService.subscribe falhou:', err);
        onError?.(err);
      }
    );
  },

  async saveConfig(partial: Partial<Raffle>): Promise<void> {
    if (!db) throw new Error('Firebase indisponível');
    await ensureAdminAuth();
    await setDoc(
      doc(db, COL, RAFFLE_DOC),
      { ...partial, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },

  // Todos os cadastrados entram no sorteio. Lê só a coleção `users` — de
  // propósito não usa customerService.getAllCustomersAsync(), que também
  // varre `orders` inteira (custo de leitura alto) e não devolve o id do doc.
  async listParticipants(): Promise<RaffleParticipant[]> {
    if (!db) return [];
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => {
        const data = d.data() as unknown;
        if (!data || typeof data !== 'object') {
          return { id: d.id, name: '', email: '', followsInstagram: false, followsTiktok: false };
        }
        const record = data as Record<string, unknown>;
        const follows = (record.socialFollows as unknown) ?? {};
        const followsRecord = typeof follows === 'object' && follows !== null 
          ? (follows as Record<string, unknown>) 
          : {};
        return {
          id: d.id,
          name: (typeof record.name === 'string' ? record.name : '') || (typeof record.email === 'string' ? record.email : '') || 'Sem nome',
          email: typeof record.email === 'string' ? record.email : '',
          followsInstagram: Boolean(followsRecord.instagram),
          followsTiktok: Boolean(followsRecord.tiktok),
        };
      });
    } catch (e) {
      devWarn('raffleService.listParticipants falhou:', e);
      return [];
    }
  },

  // Sorteia sem repetição: embaralha os participantes (Fisher-Yates) e fatia
  // um por prêmio. Com menos participantes que prêmios, sobram posições vazias
  // em vez de repetir alguém.
  async draw(prizes: RafflePrize[], participants: RaffleParticipant[]): Promise<RaffleWinner[]> {
    const pool = [...participants];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const ordered = [...prizes].sort((a, b) => a.rank - b.rank);
    const winners: RaffleWinner[] = ordered.slice(0, pool.length).map((prize, i) => ({
      rank: prize.rank,
      userId: pool[i].id,
      userName: pool[i].name,
      userEmail: pool[i].email,
      followsInstagram: pool[i].followsInstagram,
      followsTiktok: pool[i].followsTiktok,
    }));

    const drawnAt = new Date().toISOString();
    await this.saveConfig({ winners, drawnAt });
    return winners;
  },

  async publish(flag: boolean): Promise<void> {
    await this.saveConfig({ published: flag });
  },
};
