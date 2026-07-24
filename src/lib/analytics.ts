// Camada única de analytics de conversão (GA4 via Firebase Analytics + Meta Pixel).
//
// Por que Firebase Analytics em vez de gtag.js solto: o projeto já tem um
// measurementId real vinculado em src/config/firebase.ts, então getAnalytics(app)
// já fala com a MESMA propriedade GA4 que gtag.js falaria — carregar os dois
// duplicaria pageviews/sessões. Meta Pixel não existe em nenhum lugar do
// projeto, então é carregado do zero aqui, também via script.
//
// Consentimento: nada aqui inicializa ou dispara SEM `consent === 'accepted'`
// (mesmo gate do CookieBanner/useCookieConsent). Todas as funções são no-op
// seguro se: sem consentimento, sem Firebase, ou sem VITE_META_PIXEL_ID
// configurado — nunca lança erro, nunca quebra a navegação do usuário.

import type { Analytics } from 'firebase/analytics';
import { app } from '@/config/firebase';
import { getCookieConsent } from '@/hooks/useCookieConsent';

const isDev = import.meta.env.DEV;
const devWarn = isDev ? console.warn.bind(console) : () => {};

const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: (...args: unknown[]) => void };
    _fbq?: Window['fbq'];
  }
}

let analyticsInstance: Analytics | null = null;
let analyticsInitPromise: Promise<Analytics | null> | null = null;
let pixelReady = false;

function consentGiven(): boolean {
  return getCookieConsent() === 'accepted';
}

/** Carrega o SDK do Firebase Analytics (GA4) uma única vez, sob consentimento. */
async function ensureGa(): Promise<Analytics | null> {
  if (!consentGiven() || !app) return null;
  if (analyticsInstance) return analyticsInstance;
  if (!analyticsInitPromise) {
    analyticsInitPromise = import('firebase/analytics')
      .then(({ getAnalytics }) => {
        analyticsInstance = getAnalytics(app!);
        return analyticsInstance;
      })
      .catch((error) => {
        devWarn('[analytics] Falha ao inicializar GA4:', error);
        return null;
      });
  }
  return analyticsInitPromise;
}

/** Injeta o script base do Meta Pixel uma única vez, sob consentimento. */
function ensureMetaPixel(): void {
  if (!consentGiven() || !META_PIXEL_ID || pixelReady || typeof window === 'undefined') return;
  if (window.fbq) {
    pixelReady = true;
    window.fbq('init', META_PIXEL_ID);
    return;
  }

  // Bootstrap padrão do Meta Pixel (equivalente ao snippet oficial).
  const fbq: Window['fbq'] = function fbqStub(...args: unknown[]) {
    (fbqStub.callMethod ? fbqStub.callMethod : (fbqStub.queue = fbqStub.queue || []).push).apply(fbqStub, args as never);
  } as Window['fbq'];
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  fbq!.queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onerror = () => devWarn('[analytics] Falha ao carregar Meta Pixel');
  document.head.appendChild(script);

  pixelReady = true;
  window.fbq('init', META_PIXEL_ID);
}

/** Chamado uma vez quando o consentimento vira 'accepted' (ou no boot, se já aceito). */
export function initAnalytics(): void {
  if (!consentGiven()) return;
  void ensureGa();
  ensureMetaPixel();
}

/** Dispara pageview no GA4 e no Meta Pixel. Chamar a cada mudança de rota (SPA). */
export function trackPageview(path: string): void {
  if (!consentGiven()) return;
  void ensureGa().then((analytics) => {
    if (!analytics) return;
    import('firebase/analytics').then(({ logEvent }) => {
      logEvent(analytics, 'page_view', {
        page_path: path,
        page_location: typeof window !== 'undefined' ? window.location.href : path,
        page_title: typeof document !== 'undefined' ? document.title : undefined,
      });
    });
  });
  if (window.fbq && pixelReady) window.fbq('track', 'PageView');
}

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_category?: string;
}

interface EcommercePayload {
  currency?: string;
  value?: number;
  items?: AnalyticsItem[];
  transaction_id?: string;
  [key: string]: unknown;
}

/**
 * Dispara um evento de e-commerce nas duas plataformas com o vocabulário
 * correto de cada uma (GA4 usa snake_case tipo `add_to_cart`; Meta usa
 * PascalCase tipo `AddToCart`). `metaName` omitido = evento não vai pro Meta.
 */
function fireEvent(gaName: string, metaName: string | null, payload: EcommercePayload): void {
  if (!consentGiven()) return;

  void ensureGa().then((analytics) => {
    if (!analytics) return;
    import('firebase/analytics').then(({ logEvent }) => logEvent(analytics, gaName, payload));
  });

  if (metaName && window.fbq && pixelReady) {
    window.fbq('track', metaName, {
      currency: payload.currency,
      value: payload.value,
      content_ids: payload.items?.map((i) => i.item_id),
      contents: payload.items?.map((i) => ({ id: i.item_id, quantity: i.quantity || 1 })),
      content_type: 'product',
    });
  }
}

export const trackSignUp = (method: string): void =>
  fireEvent('sign_up', 'CompleteRegistration', { method });

export const trackLogin = (method: string): void =>
  fireEvent('login', null, { method });

export const trackViewItem = (item: AnalyticsItem, currency: string): void =>
  fireEvent('view_item', 'ViewContent', { currency, value: item.price, items: [item] });

export const trackAddToCart = (item: AnalyticsItem, currency: string): void =>
  fireEvent('add_to_cart', 'AddToCart', {
    currency,
    value: (item.price || 0) * (item.quantity || 1),
    items: [item],
  });

export const trackBeginCheckout = (currency: string, value: number, items: AnalyticsItem[]): void =>
  fireEvent('begin_checkout', 'InitiateCheckout', { currency, value, items });

export const trackPurchase = (
  orderId: string,
  currency: string,
  value: number,
  items: AnalyticsItem[],
): void =>
  fireEvent('purchase', 'Purchase', { transaction_id: orderId, currency, value, items });
