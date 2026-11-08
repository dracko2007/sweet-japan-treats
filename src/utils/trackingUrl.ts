/**
 * Transportadora do pedido → opção do modal de rastreio. Os pedidos guardam o
 * código do checkout (`ems`, `yuubin`…); o modal lista nomes. Sem este mapa o
 * select abria com um valor que não existe na lista, e quem não trocava
 * salvava o envio com a transportadora em código e sem link de rastreio.
 */
export function trackingCarrierOption(carrier: string | undefined | null): string {
  const id = String(carrier || '').trim().toLowerCase();
  if (['yuubin', 'ems', 'eraito', 'kozutsumi-air'].includes(id)) return 'Japan Post';
  if (id === 'yamato') return 'Yamato';
  if (id === 'sagawa') return 'Sagawa';
  return String(carrier || '');
}

/** Link público de rastreio; vazio quando a transportadora não é reconhecida. */
export function trackingUrlFor(carrier: string, trackingNumber: string): string {
  const tn = encodeURIComponent(trackingNumber.trim());
  const lc = trackingCarrierOption(carrier).toLowerCase();
  if (lc.includes('yamato') || lc.includes('クロネコ')) return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${tn}`;
  if (lc.includes('sagawa') || lc.includes('佐川')) return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${tn}`;
  if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('post')) return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=ja`;
  if (lc.includes('fukutsu') || lc.includes('福通')) return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${tn}`;
  if (lc.includes('correios')) return `https://www.linketrack.com/trace?code=${tn}`;
  return '';
}
