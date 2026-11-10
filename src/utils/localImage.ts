// Fotos de produto servidas pelo próprio site.
//
// `scripts/sync-local-catalog.mjs` copia as fotos do Firebase para /catalog em
// WebP, em dois tamanhos. Aqui só trocamos o endereço NA HORA DE MOSTRAR: o
// dado do produto continua com a URL original, porque ela é a que vai para o
// pedido, para os e-mails, para o feed do Google e de volta ao admin ao editar.
// Foto sem cópia local (produto novo) cai na URL original, sem quebrar nada.
import { imageKey } from '../../shared/image-key.js';
import { LOCAL_CATALOG_IMAGES } from '@/data/localCatalogImages';

type Size = 'thumb' | 'full';
const WIDTH: Record<Size, number> = { thumb: 480, full: 1200 };
const cache = new Map<string, string>();

/** Endereço local da foto (`thumb` para cards e miniaturas, `full` para a foto grande). */
export function localImage(url: string | undefined | null, size: Size = 'full'): string {
  if (!url) return '';
  if (!url.startsWith('https://')) return url;
  const id = `${size}|${url}`;
  let resolved = cache.get(id);
  if (resolved === undefined) {
    const key = imageKey(url);
    resolved = key && LOCAL_CATALOG_IMAGES.has(key) ? `/catalog/${key}-${WIDTH[size]}.webp` : url;
    cache.set(id, resolved);
  }
  return resolved;
}

/** Miniatura de um produto para cards e listas. */
export function productThumb(product: { thumbnail?: string; image?: string }): string {
  return localImage(product.thumbnail || product.image, 'thumb');
}
