#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔧 Corrigindo URLs de imagens...\n');

const productsFilePath = path.join(__dirname, 'src', 'data', 'products.ts');
let content = fs.readFileSync(productsFilePath, 'utf8');

// Mapeamento exato de produtos
const productMap = [
  { id: 'biore-uv', category: 'cosmeticos' },
  { id: 'hada-labo', category: 'cosmeticos' },
  { id: 'dhc-cleansing', category: 'cosmeticos' },
  { id: 'melano-cc', category: 'cosmeticos' },
  { id: 'senka-whip', category: 'cosmeticos' },
  { id: 'lululun-mask', category: 'cosmeticos' },
  { id: 'keana-mask', category: 'cosmeticos' },
  { id: 'curel-cream', category: 'cosmeticos' },
  { id: 'softymo-oil', category: 'cosmeticos' },
  { id: 'anessa-sun', category: 'cosmeticos' },
  { id: 'kitkat-matcha', category: 'doces' },
  { id: 'sencha-tea', category: 'doces' },
  { id: 'pocky-chocolate', category: 'doces' },
  { id: 'jagariko-calbee', category: 'doces' },
  { id: 'takenoko-meiji', category: 'doces' },
  { id: 'konjac-jelly', category: 'doces' },
  { id: 'matcha-powder', category: 'doces' },
  { id: 'hichew-candy', category: 'doces' },
  { id: 'kakijack', category: 'doces' },
  { id: 'royce-matcha', category: 'doces' },
  { id: 'luffy-figure', category: 'acessorios' },
  { id: 'kirby-plush', category: 'acessorios' },
  { id: 'muji-organizer', category: 'acessorios' },
  { id: 'tiger-bottle', category: 'acessorios' },
  { id: 'nerv-totebag', category: 'acessorios' },
  { id: 'demon-slayer-pad', category: 'acessorios' },
  { id: 'naruto-nendo', category: 'acessorios' },
  { id: 'divoom-speaker', category: 'acessorios' },
  { id: 'zojirushi-mug', category: 'acessorios' },
  { id: 'moon-cushion', category: 'acessorios' },
  { id: 'sakura-pens', category: 'papelaria' },
  { id: 'kokuyo-notebooks', category: 'papelaria' },
  { id: 'tombow-eraser', category: 'papelaria' },
  { id: 'washi-tape', category: 'papelaria' },
  { id: 'lihit-case', category: 'papelaria' },
  { id: 'pilot-kakuno', category: 'papelaria' },
  { id: 'tombow-pencil', category: 'papelaria' },
  { id: 'midori-notebook', category: 'papelaria' },
  { id: 'pentel-pens', category: 'papelaria' },
  { id: 'signo-dx', category: 'papelaria' }
];

let updated = 0;

// Para cada produto, substitui a imagem e gallery
for (const product of productMap) {
  const mainImage = `/images/${product.category}/${product.id}-1.jpg`;
  const galleryImages = [1, 2, 3, 4, 5]
    .map(i => `/images/${product.category}/${product.id}-${i}.jpg`)
    .map(url => `'${url}'`)
    .join(',\n      ');

  // Encontra a seção do produto
  const regex = new RegExp(
    `({\s*id:\s*['"\`]${product.id.replace(/[-\/\^$*+?.()|[\]{}]/g, '\$&')}['"\`][^}]*?image:\s*)'[^']*'([^}]*?gallery:\s*)\[[^\]]*\]`,
    's'
  );

  const replacement = `$1'${mainImage}'$2[
      ${galleryImages}
    ]`;

  const before = content;
  content = content.replace(regex, replacement);

  if (content !== before) {
    updated++;
    console.log(`✅ ${product.id}`);
  }
}

fs.writeFileSync(productsFilePath, content, 'utf8');
console.log(`\n✨ ${updated} produtos atualizados!\n`);

// Commit e push
try {
  const { execSync } = await import('child_process');
  execSync('git add src/data/products.ts', { cwd: __dirname, stdio: 'pipe' });
  execSync('git commit -m "fix: update product image URLs to local paths"', { cwd: __dirname, stdio: 'pipe' });
  execSync('git push origin main', { cwd: __dirname, stdio: 'pipe' });
  console.log('✅ Commit e push realizados');
} catch (e) {
  console.log('⚠️  Git: ' + e.message.split('\n')[0]);
}

// Deploy
try {
  const { execSync } = await import('child_process');
  console.log('🚀 Deployando...');
  const result = execSync('vercel --prod --confirm', { cwd: __dirname, encoding: 'utf8' });
  console.log('✅ Deploy concluído!');
} catch (e) {
  console.log('Deploy: ' + e.message.split('\n')[0]);
}
