import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseSyncService } from '@/services/firebaseSyncService';

export type SocialNetwork = 'instagram' | 'facebook' | 'tiktok' | 'x';

export const SOCIAL_POINTS = 500;

export const SOCIAL_CONFIG: Record<SocialNetwork, { label: string; url: string; color: string }> = {
  instagram: { label: 'Instagram', url: 'https://www.instagram.com/japan_express_oficial/', color: 'bg-pink-500' },
  facebook:  { label: 'Facebook',  url: 'https://www.facebook.com/japanexpress.br',         color: 'bg-blue-600' },
  tiktok:    { label: 'TikTok',    url: 'https://www.tiktok.com/@japan_express_oficial',     color: 'bg-gray-900' },
  x:         { label: 'X (Twitter)', url: 'https://x.com/japanexpress_br',                  color: 'bg-black' },
};

export const socialFollowService = {
  async getFollowedNetworks(userId: string): Promise<Partial<Record<SocialNetwork, boolean>>> {
    if (!db) return {};
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      return (snap.data()?.socialFollows as Partial<Record<SocialNetwork, boolean>>) || {};
    } catch { return {}; }
  },

  async confirmFollow(userId: string, network: SocialNetwork): Promise<{ ok: boolean; alreadyClaimed: boolean }> {
    if (!db) return { ok: false, alreadyClaimed: false };
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      const follows = (snap.data()?.socialFollows || {}) as Record<string, boolean>;
      if (follows[network]) return { ok: false, alreadyClaimed: true };
      // Mark as followed — setDoc+merge creates the doc if it doesn't exist yet
      await setDoc(doc(db, 'users', userId), {
        socialFollows: { [network]: true },
      }, { merge: true });
      // Award points via firebaseSyncService
      const current = snap.data()?.points || 0;
      await firebaseSyncService.syncUserToFirestore(userId, { points: current + SOCIAL_POINTS });
      return { ok: true, alreadyClaimed: false };
    } catch { return { ok: false, alreadyClaimed: false }; }
  },
};
