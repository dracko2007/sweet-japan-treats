const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/data/products.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Simples: substitui todas as URLs do Amazon pelas locais
// Padrão: https://m.media-amazon.com/images/I/{ID}._AC_UY327_QL65_.jpg
// Para cada produto, tentamos substituir pelo padrão local

const products = [
  'biore-uv', 'hada-labo', 'dhc-cleansing', 'melano-cc', 'senka-whip', 'lululun-mask', 'keana-mask', 'curel-cream', 'softymo-oil', 'anessa-sun',
  'kitkat-matcha', 'sencha-tea', 'pocky-chocolate', 'jagariko-calbee', 'takenoko-meiji', 'konjac-jelly', 'matcha-powder', 'hichew-candy', 'kakijack', 'royce-matcha',
  'luffy-figure', 'kirby-plush', 'muji-organizer', 'tiger-bottle', 'nerv-totebag', 'demon-slayer-pad', 'naruto-nendo', 'divoom-speaker', 'zojirushi-mug', 'moon-cushion',
  'sakura-pens', 'kokuyo-notebooks', 'tombow-eraser', 'washi-tape', 'lihit-case', 'pilot-kakuno', 'tombow-pencil', 'midori-notebook', 'pentel-pens', 'signo-dx'
];

const categories = {
  'biore-uv': 'cosmeticos', 'hada-labo': 'cosmeticos', 'dhc-cleansing': 'cosmeticos', 'melano-cc': 'cosmeticos', 'senka-whip': 'cosmeticos', 'lululun-mask': 'cosmeticos', 'keana-mask': 'cosmeticos', 'curel-cream': 'cosmeticos', 'softymo-oil': 'cosmeticos', 'anessa-sun': 'cosmeticos',
  'kitkat-matcha': 'doces', 'sencha-tea': 'doces', 'pocky-chocolate': 'doces', 'jagariko-calbee': 'doces', 'takenoko-meiji': 'doces', 'konjac-jelly': 'doces', 'matcha-powder': 'doces', 'hichew-candy': 'doces', 'kakijack': 'doces', 'royce-matcha': 'doces',
  'luffy-figure': 'acessorios', 'kirby-plush': 'acessorios', 'muji-organizer': 'acessorios', 'tiger-bottle': 'acessorios', 'nerv-totebag': 'acessorios', 'demon-slayer-pad': 'acessorios', 'naruto-nendo': 'acessorios', 'divoom-speaker': 'acessorios', 'zojirushi-mug': 'acessorios', 'moon-cushion': 'acessorios',
  'sakura-pens': 'papelaria', 'kokuyo-notebooks': 'papelaria', 'tombow-eraser': 'papelaria', 'washi-tape': 'papelaria', 'lihit-case': 'papelaria', 'pilot-kakuno': 'papelaria', 'tombow-pencil': 'papelaria', 'midori-notebook': 'papelaria', 'pentel-pens': 'papelaria', 'signo-dx': 'papelaria'
};

let count = 0;

// Para cada produto, busca a seção e substitui
for (const productId of products) {
  const cat = categories[productId];
  if (!cat) continue;

  // Encontra o bloco do produto (id: 'productId'...}
  const startIdx = content.indexOf(`id: '${productId}'`);
  if (startIdx === -1) continue;

  // Encontra o próximo }
  let braceCount = 0;
  let endIdx = startIdx;
  let inString = false;
  let escaping = false;

  for (let i = startIdx; i < content.length; i++) {
    const char = content[i];
    if (escaping) { escaping = false; continue; }
    if (char === '\') { escaping = true; continue; }
    if (char === "'" && (i === 0 || content[i-1] !== '\')) { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
  }

  const block = content.substring(startIdx, endIdx);
  
  // Replace todas Amazon URLs neste bloco
  let newBlock = block;
  newBlock = newBlock.replace(/image:\s*'[^']*'/g, `image: '/images/${cat}/${productId}-1.jpg'`);
  newBlock = newBlock.replace(
    /gallery:\s*\[[^\]]*\]/s,
    `gallery: [
      '/images/${cat}/${productId}-1.jpg',
      '/images/${cat}/${productId}-2.jpg',
      '/images/${cat}/${productId}-3.jpg',
      '/images/${cat}/${productId}-4.jpg',
      '/images/${cat}/${productId}-5.jpg'
    ]`
  );

  if (newBlock !== block) {
    content = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
    count++;
    console.log(`✅ ${productId}`);
  }
}

fs.writeFileSync(filePath, content);
console.log(`\n✨ ${count} produtos atualizados!`);
