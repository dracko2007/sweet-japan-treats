import { describe, expect, it } from 'vitest';
import { oembedEndpoint, parseReviewUrl } from './review-links.js';

describe('links de review do divulgador', () => {
  it('reconhece os formatos do YouTube', () => {
    const esperado = { platform: 'youtube', videoId: 'tYcA1j-fcKg', url: 'https://www.youtube.com/watch?v=tYcA1j-fcKg' };
    expect(parseReviewUrl('https://www.youtube.com/watch?v=tYcA1j-fcKg&t=10s')).toEqual(esperado);
    expect(parseReviewUrl('https://youtu.be/tYcA1j-fcKg?si=abc')).toEqual(esperado);
    expect(parseReviewUrl('https://m.youtube.com/shorts/tYcA1j-fcKg')).toEqual(esperado);
  });

  it('reconhece TikTok completo e curto', () => {
    expect(parseReviewUrl('https://www.tiktok.com/@loja.jp/video/7301234567890123456?lang=pt'))
      .toEqual({ platform: 'tiktok', videoId: '7301234567890123456', url: 'https://www.tiktok.com/@loja.jp/video/7301234567890123456' });
    expect(parseReviewUrl('https://vm.tiktok.com/ZMabc123/')).toMatchObject({ platform: 'tiktok', videoId: '' });
  });

  it('reconhece reel e post do Instagram', () => {
    expect(parseReviewUrl('https://www.instagram.com/reel/Cxyz_123-AB/?igsh=1'))
      .toEqual({ platform: 'instagram', videoId: 'Cxyz_123-AB', url: 'https://www.instagram.com/reel/Cxyz_123-AB/' });
    expect(parseReviewUrl('https://instagram.com/usuario/p/Cxyz_123/')).toMatchObject({ platform: 'instagram', url: 'https://www.instagram.com/p/Cxyz_123/' });
  });

  it('recusa outros sites, http e links sem vídeo', () => {
    for (const link of [
      'https://example.com/watch?v=tYcA1j-fcKg',
      'https://youtube.com.evil.com/watch?v=tYcA1j-fcKg',
      'http://www.youtube.com/watch?v=tYcA1j-fcKg',
      'https://www.youtube.com/@canal',
      'https://www.instagram.com/usuario/',
      'https://www.tiktok.com/@loja.jp',
      'javascript:alert(1)',
      '',
    ]) expect(parseReviewUrl(link)).toBeNull();
  });

  it('só busca metadados onde o oEmbed é público', () => {
    expect(oembedEndpoint(parseReviewUrl('https://youtu.be/tYcA1j-fcKg'))).toContain('https://www.youtube.com/oembed?');
    expect(oembedEndpoint(parseReviewUrl('https://www.instagram.com/reel/Cxyz_123/'))).toBe('');
  });
});
