#!/usr/bin/env node
// Copia o catálogo e as fotos dos produtos para dentro do próprio site.
//
//   node scripts/sync-local-catalog.mjs            (só o que ainda não foi baixado)
//   node scripts/sync-local-catalog.mjs --force    (refaz todas as fotos)
//
// Gera:
//   public/catalog/<id>-480.webp e <id>-1200.webp   fotos otimizadas (cards / página do produto)
//   public/catalog/snapshot.json                    retrato do catálogo para a primeira visita
//   src/data/localCatalogImages.ts                  quais fotos têm cópia local
//
// O Firestore continua sendo a fonte: preço, estoque e edições do admin chegam
// pela sincronização normal. Foto nova enviada pelo admin funciona direto do
// Firebase até este script rodar de novo.
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { imageKey } from '../shared/image-key.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'catalog');
const SITE = process.env.CATALOG_SOURCE || 'https://www.japanexpress-store.com';
const FORCE = process.argv.includes('--force');
const SIZES = [[480, 76], [1200, 82]]; // [largura máxima, qualidade webp]

const exists = (file) => access(file).then(() => true, () => false);

async function fetchRetry(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt >= tries) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
}

const catalog = await (await fetchRetry(`${SITE}/api/products?_catalog=${Date.now()}`)).json();
const items = Array.isArray(catalog.items) ? catalog.items : [];
if (!items.length) throw new Error('catálogo vazio: nada foi alterado');

const urls = [...new Set(items.flatMap((p) => [p.image, p.thumbnail, ...(p.gallery || [])]).filter((u) => typeof u === 'string' && /^https:\/\//.test(u)))];
await mkdir(OUT, { recursive: true });

const done = [];
let downloaded = 0;
let failed = 0;
const queue = [...urls];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let url = queue.shift(); url; url = queue.shift()) {
    const key = imageKey(url);
    const files = SIZES.map(([width]) => path.join(OUT, `${key}-${width}.webp`));
    try {
      if (FORCE || !(await Promise.all(files.map(exists))).every(Boolean)) {
        const original = Buffer.from(await (await fetchRetry(url)).arrayBuffer());
        await Promise.all(SIZES.map(([width, quality], index) =>
          sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(files[index])));
        downloaded += 1;
      }
      done.push(key);
    } catch (error) {
      failed += 1;
      console.warn(`falhou: ${url.slice(0, 110)} — ${error.message}`);
    }
  }
}));

await writeFile(path.join(OUT, 'snapshot.json'), JSON.stringify({ items, deleted: catalog.deleted || [], syncedAtMs: Number(catalog.maxMs) || 0 }));
await writeFile(
  path.join(ROOT, 'src', 'data', 'localCatalogImages.ts'),
  `// GERADO por scripts/sync-local-catalog.mjs — não editar à mão.\n// Fotos de produto com cópia otimizada em /catalog (chave = hash do caminho no Firebase).\nexport const LOCAL_CATALOG_IMAGES: ReadonlySet<string> = new Set(${JSON.stringify(done.sort())});\n`,
);
console.log(`${items.length} produtos · ${urls.length} fotos · ${downloaded} baixadas agora · ${failed} falharam`);
