import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Erro: ${serviceAccountPath} não encontrado`);
  console.error('Passos:');
  console.error('1. Vá para Firebase Console > Project Settings');
  console.error('2. Clique em "Service Accounts"');
  console.error('3. Clique em "Generate New Private Key"');
  console.error('4. Salve como serviceAccountKey.json na raiz do projeto');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || serviceAccount.project_id + '.appspot.com'
});

const bucket = admin.storage().bucket();

// Mapeamento de produtos
const productMapping: Record<string, { category: string; count: number }> = {
  'biore-uv': { category: 'cosmeticos', count: 5 },
  'hada-labo': { category: 'cosmeticos', count: 5 },
  'dhc-cleansing': { category: 'cosmeticos', count: 5 },
  'melano-cc': { category: 'cosmeticos', count: 5 },
  'senka-whip': { category: 'cosmeticos', count: 5 },
  'lululun-mask': { category: 'cosmeticos', count: 5 },
  'keana-mask': { category: 'cosmeticos', count: 5 },
  'curel-cream': { category: 'cosmeticos', count: 5 },
  'softymo-oil': { category: 'cosmeticos', count: 5 },
  'anessa-sun': { category: 'cosmeticos', count: 5 },
  'kitkat-matcha': { category: 'doces', count: 5 },
  'sencha-tea': { category: 'doces', count: 5 },
  'pocky-chocolate': { category: 'doces', count: 5 },
  'jagariko-calbee': { category: 'doces', count: 5 },
  'takenoko-meiji': { category: 'doces', count: 5 },
  'konjac-jelly': { category: 'doces', count: 5 },
  'matcha-powder': { category: 'doces', count: 5 },
  'hichew-candy': { category: 'doces', count: 5 },
  'kakijack': { category: 'doces', count: 5 },
  'royce-matcha': { category: 'doces', count: 5 },
  'luffy-figure': { category: 'acessorios', count: 5 },
  'kirby-plush': { category: 'acessorios', count: 5 },
  'muji-organizer': { category: 'acessorios', count: 5 },
  'tiger-bottle': { category: 'acessorios', count: 5 },
  'nerv-totebag': { category: 'acessorios', count: 5 },
  'demon-slayer-pad': { category: 'acessorios', count: 5 },
  'naruto-nendo': { category: 'acessorios', count: 5 },
  'divoom-speaker': { category: 'acessorios', count: 5 },
  'zojirushi-mug': { category: 'acessorios', count: 5 },
  'moon-cushion': { category: 'acessorios', count: 5 },
  'sakura-pens': { category: 'papelaria', count: 5 },
  'kokuyo-notebooks': { category: 'papelaria', count: 5 },
  'tombow-eraser': { category: 'papelaria', count: 5 },
  'washi-tape': { category: 'papelaria', count: 5 },
  'lihit-case': { category: 'papelaria', count: 5 },
  'pilot-kakuno': { category: 'papelaria', count: 5 },
  'tombow-pencil': { category: 'papelaria', count: 5 },
  'midori-notebook': { category: 'papelaria', count: 5 },
  'pentel-pens': { category: 'papelaria', count: 5 },
  'signo-dx': { category: 'papelaria', count: 5 }
};

async function uploadImages() {
  console.log('🚀 Iniciando upload de imagens para Firebase Storage...\n');

  const imageUrls: Record<string, string[]> = {};
  let uploadedCount = 0;
  let skippedCount = 0;

  for (const [productId, { category }] of Object.entries(productMapping)) {
    const imagePath = path.join(__dirname, 'public', 'images', category, `${productId}-1.jpg`);

    if (!fs.existsSync(imagePath)) {
      console.log(`⏭️  Pulando ${productId} (arquivo não encontrado)`);
      skippedCount++;
      continue;
    }

    try {
      const remoteFile = bucket.file(`products/${category}/${productId}/${path.basename(imagePath)}`);

      await bucket.upload(imagePath, {
        destination: remoteFile,
        metadata: {
          cacheControl: 'public, max-age=31536000'
        }
      });

      // Make file public
      await remoteFile.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/products/${category}/${productId}/${path.basename(imagePath)}`;

      if (!imageUrls[productId]) {
        imageUrls[productId] = [];
      }
      imageUrls[productId].push(publicUrl);
      uploadedCount++;

      console.log(`✅ ${productId}: uploaded`);
    } catch (error) {
      console.error(`❌ Erro ao fazer upload ${productId}:`, error);
    }
  }

  console.log(`\n📊 Resultado: ${uploadedCount} imagens enviadas, ${skippedCount} puladas`);
  console.log('\n💾 Salve o JSON abaixo em image-urls.json:');
  console.log(JSON.stringify(imageUrls, null, 2));
}

uploadImages().catch(console.error);
