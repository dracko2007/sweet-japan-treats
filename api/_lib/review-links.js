// Links de review enviados pelos divulgadores: só YouTube, TikTok e Instagram.
// Tudo aqui é puro (sem rede) para o painel e o servidor concordarem.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function hostOf(url) {
  return url.hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, '');
}

/**
 * Reconhece o link e devolve uma forma canônica.
 * @returns {{ platform: 'youtube'|'tiktok'|'instagram', videoId: string, url: string } | null}
 */
export function parseReviewUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = hostOf(url);
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'youtube.com') {
    const id = host === 'youtu.be'
      ? parts[0]
      : parts[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '';
    if (!YOUTUBE_ID.test(id || '')) return null;
    return { platform: 'youtube', videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }

  if (host === 'tiktok.com') {
    // Link completo: /@usuario/video/123. Link curto (vm.tiktok.com/XXXX): sem id, mas válido.
    const full = parts[0]?.startsWith('@') && parts[1] === 'video' && /^\d{6,25}$/.test(parts[2] || '');
    if (full) return { platform: 'tiktok', videoId: parts[2], url: `https://www.tiktok.com/${parts[0]}/video/${parts[2]}` };
    const short = /^(vm|vt)\./.test(url.hostname.toLowerCase()) || parts[0] === 't';
    const code = parts[0] === 't' ? parts[1] : parts[0];
    if (short && /^[A-Za-z0-9]{5,20}$/.test(code || '')) return { platform: 'tiktok', videoId: '', url: `https://${url.hostname.toLowerCase()}/${parts.join('/')}/` };
    return null;
  }

  if (host === 'instagram.com') {
    // /reel/CODE, /p/CODE, /tv/CODE — com ou sem o usuário na frente.
    const index = parts.findIndex((part) => ['reel', 'reels', 'p', 'tv'].includes(part));
    const code = index >= 0 ? parts[index + 1] : '';
    if (index > 1 || !/^[A-Za-z0-9_-]{5,40}$/.test(code || '')) return null;
    const kind = parts[index] === 'p' ? 'p' : parts[index] === 'tv' ? 'tv' : 'reel';
    return { platform: 'instagram', videoId: code, url: `https://www.instagram.com/${kind}/${code}/` };
  }

  return null;
}

/** Endpoint público de oEmbed (título e miniatura). Instagram exige app aprovado pela Meta: fica sem. */
export function oembedEndpoint(review) {
  if (review.platform === 'youtube') return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(review.url)}`;
  if (review.platform === 'tiktok') return `https://www.tiktok.com/oembed?url=${encodeURIComponent(review.url)}`;
  return '';
}
