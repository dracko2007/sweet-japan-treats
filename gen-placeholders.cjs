const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Nome curto + categoria de cada produto
const PRODUCTS = {
  cosmeticos: {
    color: '#EC4899', bg: '#FDF2F8', label: 'COSMÉTICOS',
    items: {
      'biore-uv': 'Bioré UV Aqua Rich SPF50+',
      'hada-labo': 'Hada Labo Gokujyun Lotion',
      'dhc-cleansing': 'DHC Deep Cleansing Oil',
      'melano-cc': 'Melano CC Vitamin C',
      'senka-whip': 'Senka Perfect Whip',
      'lululun-mask': 'Lululun Face Mask',
      'keana-mask': 'Keana Nadeshiko Mask',
      'curel-cream': 'Curél Hidratante',
      'softymo-oil': 'Softymo Cleansing Oil',
      'anessa-sun': 'Anessa Protetor Solar',
    },
  },
  doces: {
    color: '#F59E0B', bg: '#FFFBEB', label: 'DOCES & CHÁS',
    items: {
      'kitkat-matcha': 'KitKat Matcha',
      'sencha-tea': 'Chá Sencha',
      'pocky-chocolate': 'Pocky Chocolate',
      'jagariko-calbee': 'Jagariko Calbee',
      'takenoko-meiji': 'Takenoko no Sato',
      'konjac-jelly': 'Geleia Konjac',
      'matcha-powder': 'Matcha em Pó',
      'hichew-candy': 'Hi-Chew',
      'kakijack': 'Kaki no Tane',
      'royce-matcha': 'Royce Matcha',
    },
  },
  acessorios: {
    color: '#EF4444', bg: '#FEF2F2', label: 'ACESSÓRIOS',
    items: {
      'luffy-figure': 'Figure Luffy',
      'kirby-plush': 'Pelúcia Kirby',
      'muji-organizer': 'Organizador MUJI',
      'tiger-bottle': 'Garrafa Tiger',
      'nerv-totebag': 'Tote Bag NERV',
      'demon-slayer-pad': 'Mousepad Demon Slayer',
      'naruto-nendo': 'Naruto Nendoroid',
      'divoom-speaker': 'Divoom Speaker',
      'zojirushi-mug': 'Caneca Zojirushi',
      'moon-cushion': 'Almofada Lua',
    },
  },
  papelaria: {
    color: '#14B8A6', bg: '#F0FDFA', label: 'PAPELARIA',
    items: {
      'sakura-pens': 'Canetas Sakura',
      'kokuyo-notebooks': 'Cadernos Kokuyo',
      'tombow-eraser': 'Borracha Tombow',
      'washi-tape': 'Washi Tape',
      'lihit-case': 'Estojo Lihit',
      'pilot-kakuno': 'Pilot Kakuno',
      'tombow-pencil': 'Lápis Tombow',
      'midori-notebook': 'Caderno Midori',
      'pentel-pens': 'Canetas Pentel',
      'signo-dx': 'Uni-ball Signo DX',
    },
  },
};

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Quebra o nome em linhas de no máx ~16 caracteres
function wrap(text, max = 16) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function svg(name, color, bg, label) {
  const lines = wrap(name);
  const startY = 300 - (lines.length - 1) * 26;
  const tspans = lines.map((l, i) =>
    `<text x="300" y="${startY + i * 52}" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#1f2937" text-anchor="middle">${escapeXml(l)}</text>`
  ).join('');

  return `<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="600" fill="${bg}"/>
    <rect x="0" y="0" width="600" height="14" fill="${color}"/>
    <circle cx="300" cy="150" r="44" fill="${color}" opacity="0.15"/>
    <circle cx="300" cy="150" r="22" fill="${color}"/>
    ${tspans}
    <rect x="220" y="392" width="160" height="36" rx="18" fill="${color}" opacity="0.12"/>
    <text x="300" y="416" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="1">${escapeXml(label)}</text>
    <text x="300" y="540" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#9ca3af" text-anchor="middle" letter-spacing="2">SAKURA EXPRESS</text>
  </svg>`;
}

(async () => {
  let count = 0;
  for (const [category, cfg] of Object.entries(PRODUCTS)) {
    const dir = path.join(__dirname, 'public', 'images', category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    for (const [id, name] of Object.entries(cfg.items)) {
      const buffer = Buffer.from(svg(name, cfg.color, cfg.bg, cfg.label));
      for (let i = 1; i <= 5; i++) {
        const file = path.join(dir, `${id}-${i}.jpg`);
        await sharp(buffer).jpeg({ quality: 88 }).toFile(file);
        count++;
      }
      console.log('OK ' + id + ' -> ' + name);
    }
  }
  console.log('\nTotal: ' + count + ' imagens geradas');
})();
