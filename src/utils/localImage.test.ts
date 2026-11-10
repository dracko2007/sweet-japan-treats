import { describe, expect, it } from 'vitest';
import retrato from '../../public/catalog/snapshot.json';
import { localImage, productThumb } from './localImage';

// O retrato e as fotos são gerados juntos por scripts/sync-local-catalog.mjs.
const snapshot = retrato as unknown as { items: { image?: string; thumbnail?: string }[] };

describe('fotos de produto locais', () => {
  it('toda foto principal do retrato tem cópia local nos dois tamanhos', () => {
    const comFoto = snapshot.items.filter((product) => product.image?.startsWith('https://'));
    expect(comFoto.length).toBeGreaterThan(100);
    for (const product of comFoto) {
      for (const size of ['thumb', 'full'] as const) {
        const local = localImage(product.image, size);
        expect(local).toMatch(size === 'thumb' ? /^\/catalog\/[0-9a-f]{14}-480\.webp$/ : /^\/catalog\/[0-9a-f]{14}-1200\.webp$/);
      }
    }
  });

  it('o token da URL não muda a cópia encontrada', () => {
    const url = snapshot.items.find((product) => product.image?.startsWith('https://'))?.image || '';
    expect(localImage(`${url.split('?')[0]}?alt=media&token=outro`)).toBe(localImage(url));
  });

  it('foto sem cópia local (produto novo) e caminhos locais ficam como estão', () => {
    const nova = 'https://firebasestorage.googleapis.com/v0/b/x/o/japanexpress%2Fproducts%2Fnovo.jpg?alt=media';
    expect(localImage(nova)).toBe(nova);
    expect(localImage('/logo.jpg')).toBe('/logo.jpg');
    expect(localImage(undefined)).toBe('');
    expect(productThumb({ image: nova })).toBe(nova);
  });
});
