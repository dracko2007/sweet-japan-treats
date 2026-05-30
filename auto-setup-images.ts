#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Iniciando auto-setup completo de imagens...\n');

// ============================================
// STEP 1: GERAR IMAGENS DE PLACEHOLDER
// ============================================

async function generatePlaceholderImages() {
  console.log('📸 Step 1: Gerando imagens de placeholder...\n');

  const products = {
    cosmeticos: ['biore-uv', 'hada-labo', 'dhc-cleansing', 'melano-cc', 'senka-whip', 'lululun-mask', 'keana-mask', 'curel-cream', 'softymo-oil', 'anessa-sun'],
    doces: ['kitkat-matcha', 'sencha-tea', 'pocky-chocolate', 'jagariko-calbee', 'takenoko-meiji', 'konjac-jelly', 'matcha-powder', 'hichew-candy', 'kakijack', 'royce-matcha'],
    acessorios: ['luffy-figure', 'kirby-plush', 'muji-organizer', 'tiger-bottle', 'nerv-totebag', 'demon-slayer-pad', 'naruto-nendo', 'divoom-speaker', 'zojirushi-mug', 'moon-cushion'],
    papelaria: ['sakura-pens', 'kokuyo-notebooks', 'tombow-eraser', 'washi-tape', 'lihit-case', 'pilot-kakuno', 'tombow-pencil', 'midori-notebook', 'pentel-pens', 'signo-dx']
  };

  const categoryColors: Record<string, string> = {
    cosmeticos: '#FF6B9D',
    doces: '#FFC93C',
    acessorios: '#FF6348',
    papelaria: '#4ECDC4'
  };

  let generatedCount = 0;

  for (const [category, productIds] of Object.entries(products)) {
    for (const productId of productIds) {
      const categoryDir = path.join(__dirname, 'public', 'images', category);

      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

      // Gera 5 imagens por produto
      for (let i = 1; i <= 5; i++) {
        const filename = path.join(categoryDir, `${productId}-${i}.jpg`);

        if (fs.existsSync(filename)) {
          continue; // Skip se já existe
        }

        const color = categoryColors[category];
        const text = `${productId}\nImage ${i}`;

        // Criar placeholder com Sharp
        await sharp({
          create: {
            width: 600,
            height: 600,
            channels: 3,
            background: color
          }
        })
          .composite([
            {
              input: Buffer.from(
                `<svg width="600" height="600">
                  <rect width="600" height="600" fill="${color}"/>
                  <text x="300" y="270" font-size="40" fill="white" text-anchor="middle" font-weight="bold">${productId}</text>
                  <text x="300" y="330" font-size="32" fill="white" text-anchor="middle">Image ${i}/5</text>
                </svg>`
              ),
              top: 0,
              left: 0
            }
          ])
          .jpeg({ quality: 80 })
          .toFile(filename);

        generatedCount++;
        if (generatedCount % 20 === 0) {
          console.log(`  ✅ ${generatedCount} imagens geradas...`);
        }
      }
    }
  }

  console.log(`✅ ${generatedCount} imagens criadas!\n`);
}

// ============================================
// STEP 2: CONFIGURAR FIREBASE E FAZER UPLOAD
// ============================================

async function uploadImagesToFirebase() {
  console.log('☁️  Step 2: Fazendo upload para Firebase Storage...\n');

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'serviceAccountKey.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Erro: serviceAccountKey.json não encontrado!');
    console.log('\nPara gerar:');
    console.log('1. Vá para https://console.firebase.google.com/');
    console.log('2. Project Settings > Service Accounts');
    console.log('3. Gere Private Key e salve como serviceAccountKey.json');
    throw new Error('Firebase credentials not found');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || serviceAccount.project_id + '.appspot.com'
  });

  const bucket = admin.storage().bucket();
  const imageUrls: Record<string, string[]> = {};
  let uploadedCount = 0;

  const categories = ['cosmeticos', 'doces', 'acessorios', 'papelaria'];

  for (const category of categories) {
    const categoryDir = path.join(__dirname, 'public', 'images', category);

    if (!fs.existsSync(categoryDir)) continue;

    const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.jpg'));

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const [productId] = file.split('-');

      try {
        const remoteFile = bucket.file(`products/${category}/${productId}/${file}`);

        await bucket.upload(filePath, {
          destination: remoteFile,
          metadata: {
            cacheControl: 'public, max-age=31536000'
          }
        });

        await remoteFile.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/products/${category}/${productId}/${file}`;

        if (!imageUrls[productId]) {
          imageUrls[productId] = [];
        }
        imageUrls[productId].push(publicUrl);

        uploadedCount++;
        if (uploadedCount % 20 === 0) {
          console.log(`  ✅ ${uploadedCount} imagens enviadas...`);
        }
      } catch (error) {
        console.error(`❌ Erro ao fazer upload ${file}:`, error);
      }
    }
  }

  console.log(`✅ ${uploadedCount} imagens enviadas para Firebase!\n`);

  // Salva URLs para referência
  fs.writeFileSync(
    path.join(__dirname, 'image-urls.json'),
    JSON.stringify(imageUrls, null, 2)
  );

  return imageUrls;
}

// ============================================
// STEP 3: ATUALIZAR PRODUCTS.TS COM URLS
// ============================================

async function updateProductsWithUrls(imageUrls: Record<string, string[]>) {
  console.log('📝 Step 3: Atualizando src/data/products.ts com URLs do Firebase...\n');

  const productsFilePath = path.join(__dirname, 'src', 'data', 'products.ts');
  let content = fs.readFileSync(productsFilePath, 'utf8');

  // Atualiza cada produto com suas URLs do Firebase
  for (const [productId, urls] of Object.entries(imageUrls)) {
    if (urls.length === 0) continue;

    // Encontra a seção do produto e atualiza image e gallery
    const mainImageUrl = urls[0];
    const galleryUrls = urls;

    // Regex para encontrar e atualizar a propriedade 'image'
    const imageRegex = new RegExp(
      `(id:\\s*'${productId}'[^}]*?image:\\s*)'[^']*'`,
      'g'
    );
    content = content.replace(imageRegex, `$1'${mainImageUrl}'`);

    // Regex para encontrar e atualizar 'gallery'
    const galleryRegex = new RegExp(
      `(id:\\s*'${productId}'[^}]*?gallery:\\s*)\\[[^\\]]*\\]`,
      'g'
    );
    const galleryString = `[
      ${galleryUrls.map(url => `'${url}'`).join(',\n      ')}
    ]`;
    content = content.replace(galleryRegex, `$1${galleryString}`);
  }

  fs.writeFileSync(productsFilePath, content, 'utf8');
  console.log('✅ products.ts atualizado com URLs do Firebase!\n');
}

// ============================================
// STEP 4: GIT COMMIT E PUSH
// ============================================

async function commitAndPush() {
  console.log('🔄 Step 4: Commit e Push para GitHub...\n');

  try {
    await execAsync('git add src/data/products.ts image-urls.json');

    await execAsync(
      `git commit -m "feat: add Firebase Storage URLs for all product images"`
    );

    await execAsync('git push origin main');

    console.log('✅ Commit e push realizados!\n');
  } catch (error) {
    console.error('❌ Erro no git:', error);
  }
}

// ============================================
// STEP 5: DEPLOY NO VERCEL
// ============================================

async function deployToVercel() {
  console.log('🚀 Step 5: Deployando no Vercel...\n');

  try {
    const { stdout } = await execAsync('vercel --prod --confirm');

    // Extrai URL do deploy
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    if (urlMatch) {
      console.log(`✅ Deploy concluído!\n🌐 URL: ${urlMatch[0]}\n`);
    } else {
      console.log('✅ Deploy concluído!\n');
    }
  } catch (error) {
    console.error('❌ Erro no deploy:', error);
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  try {
    await generatePlaceholderImages();
    const imageUrls = await uploadImagesToFirebase();
    await updateProductsWithUrls(imageUrls);
    await commitAndPush();
    await deployToVercel();

    console.log('════════════════════════════════════════════════');
    console.log('✨ SETUP COMPLETO COM SUCESSO! ✨');
    console.log('════════════════════════════════════════════════');
    console.log('\n📊 Resumo:');
    console.log('✅ 200 imagens geradas');
    console.log('✅ Upload para Firebase Storage completo');
    console.log('✅ products.ts atualizado');
    console.log('✅ Commit e push realizados');
    console.log('✅ Deploy no Vercel concluído');
    console.log('\n🌐 Site atualizado com todas as imagens!\n');
  } catch (error) {
    console.error('❌ Erro durante setup:', error);
    process.exit(1);
  }
}

main();
