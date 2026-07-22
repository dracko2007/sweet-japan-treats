// Web Push (VAPID) — inscreve o cliente para notificações push nativas do
// navegador e mantém a inscrição sincronizada no Firestore (`push_subscriptions`).
// É Web Push "puro" (PushManager + service worker dedicado em /push-sw.js), não
// Firebase Cloud Messaging — funciona em qualquer navegador compatível com a
// API padrão (Chrome/Edge/Firefox desktop e Android; Safari só a partir do
// macOS 13 / iOS 16.4 e instalado como PWA na tela de início).
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SW_PATH = '/push-sw.js';
const SW_SCOPE = '/push/';

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window &&
  !!VAPID_PUBLIC_KEY;

// Converte a chave pública VAPID (base64url) para Uint8Array — formato exigido por applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
}

/** Doc id estável por assinatura (hash simples do endpoint) — evita duplicar ao reinscrever o mesmo device. */
function subscriptionDocId(endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) hash = (hash * 31 + endpoint.charCodeAt(i)) | 0;
  return 'sub-' + Math.abs(hash).toString(36);
}

export const pushService = {
  isSupported: isPushSupported,

  /** Permissão atual do navegador. */
  permission(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  },

  /** true se já existe uma inscrição push ativa neste navegador/dispositivo. */
  async isSubscribed(): Promise<boolean> {
    if (!isPushSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  },

  /** Pede permissão (se necessário), cria a inscrição e salva no Firestore ligada ao cliente. */
  async subscribe(customer: { email: string; name?: string }): Promise<{ ok: boolean; error?: string }> {
    if (!isPushSupported()) return { ok: false, error: 'Notificações push não suportadas neste navegador' };
    if (!db) return { ok: false, error: 'Firebase indisponível' };
    if (!customer.email) return { ok: false, error: 'Faça login para ativar notificações' };

    try {
      if (Notification.permission === 'denied') {
        return { ok: false, error: 'Notificações bloqueadas nas configurações do navegador' };
      }
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') return { ok: false, error: 'Permissão negada' };

      const reg = await getRegistration();
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
        });
      }

      const json = sub.toJSON();
      const id = subscriptionDocId(sub.endpoint);
      await setDoc(doc(db, 'push_subscriptions', id), {
        endpoint: sub.endpoint,
        keys: json.keys || {},
        customerEmail: customer.email.toLowerCase(),
        customerName: customer.name || '',
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
      });

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  /** Cancela a inscrição no navegador e remove do Firestore. */
  async unsubscribe(): Promise<{ ok: boolean; error?: string }> {
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const id = subscriptionDocId(sub.endpoint);
        await sub.unsubscribe();
        if (db) await deleteDoc(doc(db, 'push_subscriptions', id)).catch(() => {});
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
