#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = getApps()[0] || initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'localstorage-98492.firebasestorage.app',
});

const db = getFirestore(app);
const bucket = getStorage(app).bucket('localstorage-98492.firebasestorage.app');

async function main() {
  console.log('🔍 Varrendo arquivos no Firebase Storage (prefix: japanexpress/products/)...');
  const [files] = await bucket.getFiles({ prefix: 'japanexpress/products/' });
  console.log(`📁 Total de arquivos encontrados no Storage: ${files.length}`);

  const productsMap = new Map();

  for (const file of files) {
    const parts = file.name.split('/');
    if (parts.length >= 4) {
      const productId = parts[2];
      const fileName = parts.slice(3).join('/');
      
      const encodedPath = encodeURIComponent(file.name);
      // Firebase Storage media URL format
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

      if (!productsMap.has(productId)) {
        productsMap.set(productId, []);
      }
      productsMap.get(productId).push({
        name: fileName,
        path: file.name,
        url: downloadUrl,
      });
    }
  }

  console.log(`📦 Produtos distintos com pastas de fotos no Storage: ${productsMap.size}`);

  let updatedCount = 0;

  for (const [productId, photoList] of productsMap.entries()) {
    const coverUrl = photoList[0].url;
    const galleryUrls = photoList.map(p => p.url);

    const docRef = db.collection('products').doc(productId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data() || {};
      console.log(`✅ Atualizando produto existente [${productId}] ("${data.name || productId}") com ${galleryUrls.length} foto(s)...`);
      await docRef.set({
        image: coverUrl,
        thumbnail: coverUrl,
        gallery: galleryUrls,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      updatedCount++;
    } else {
      console.log(`✨ Criando produto novo [${productId}] no Firestore com ${galleryUrls.length} foto(s)...`);
      await docRef.set({
        id: productId,
        name: productId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        image: coverUrl,
        thumbnail: coverUrl,
        gallery: galleryUrls,
        category: 'cosmeticos',
        prices: { small: 0, large: 0 },
        variants: [{ id: 'small', label: 'Padrão', price: 0 }],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      updatedCount++;
    }
  }

  console.log(`\n🎉 Varredura e sincronização concluídas! Total de produtos vinculados às fotos: ${updatedCount}`);
}

main().catch(err => {
  console.error('Erro na varredura:', err);
  process.exit(1);
});
