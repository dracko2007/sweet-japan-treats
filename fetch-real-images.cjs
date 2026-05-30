const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// id -> { category, query }
const PRODUCTS = {
  // cosmeticos
  'biore-uv':        ['cosmeticos', 'biore uv sunscreen'],
  'hada-labo':       ['cosmeticos', 'hada labo lotion'],
  'dhc-cleansing':   ['cosmeticos', 'dhc cleansing oil'],
  'melano-cc':       ['cosmeticos', 'melano cc vitamin c serum'],
  'senka-whip':      ['cosmeticos', 'senka perfect whip foam'],
  'lululun-mask':    ['cosmeticos', 'lululun face mask'],
  'keana-mask':      ['cosmeticos', 'keana nadeshiko'],
  'curel-cream':     ['cosmeticos', 'curel moisturizer'],
  'softymo-oil':     ['cosmeticos', 'softymo cleansing oil'],
  'anessa-sun':      ['cosmeticos', 'anessa sunscreen'],
  // doces
  'kitkat-matcha':   ['doces', 'kitkat matcha'],
  'sencha-tea':      ['doces', 'sencha green tea'],
  'pocky-chocolate': ['doces', 'pocky chocolate'],
  'jagariko-calbee': ['doces', 'jagariko calbee'],
  'takenoko-meiji':  ['doces', 'takenoko no sato'],
  'konjac-jelly':    ['doces', 'konjac jelly'],
  'matcha-powder':   ['doces', 'matcha powder'],
  'hichew-candy':    ['doces', 'hi-chew candy'],
  'kakijack':        ['doces', 'kaki no tane'],
  'royce-matcha':    ['doces', 'royce chocolate'],
  // acessorios
  'luffy-figure':    ['acessorios', 'luffy one piece figure'],
  'kirby-plush':     ['acessorios', 'kirby plush'],
  'muji-organizer':  ['acessorios', 'muji storage box'],
  'tiger-bottle':    ['acessorios', 'tiger thermos bottle'],
  'nerv-totebag':    ['acessorios', 'evangelion nerv bag'],
  'demon-slayer-pad':['acessorios', 'demon slayer'],
  'naruto-nendo':    ['acessorios', 'naruto figure'],
  'divoom-speaker':  ['acessorios', 'divoom pixel speaker'],
  'zojirushi-mug':   ['acessorios', 'zojirushi mug'],
  'moon-cushion':    ['acessorios', 'moon cushion pillow'],
  // papelaria
  'sakura-pens':     ['papelaria', 'sakura gel pen'],
  'kokuyo-notebooks':['papelaria', 'kokuyo notebook'],
  'tombow-eraser':   ['papelaria', 'tombow eraser'],
  'washi-tape':      ['papelaria', 'washi tape'],
  'lihit-case':      ['papelaria', 'pen case pencil'],
  'pilot-kakuno':    ['papelaria', 'pilot fountain pen'],
  'tombow-pencil':   ['papelaria', 'tombow pencil'],
  'midori-notebook': ['papelaria', 'midori notebook'],
  'pentel-pens':     ['papelaria', 'pentel pen'],
  'signo-dx':        ['papelaria', 'uni-ball signo pen'],
};

const UA = 'SakuraExpress/1.0 (product catalog)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function searchOpenverse(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12&mature=false`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('openverse ' + res.status);
  const data = await res.json();
  return (data.results || []).map(r => r.url).filter(Boolean);
}

async function downloadAndSave(imgUrl, destPath) {
  const res = await fetch(imgUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('img ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 3000) throw new Error('too small');
  await sharp(buf).resize(600, 600, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toFile(destPath);
}

(async () => {
  const report = { real: [], partial: [], placeholder: [] };

  for (const [id, [category, query]] of Object.entries(PRODUCTS)) {
    const dir = path.join(__dirname, 'public', 'images', category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let urls = [];
    try {
      urls = await searchOpenverse(query);
    } catch (e) {
      console.log(`!! ${id}: busca falhou (${e.message})`);
    }
    // dedupe
    urls = [...new Set(urls)];

    let saved = 0;
    for (const u of urls) {
      if (saved >= 5) break;
      const dest = path.join(dir, `${id}-${saved + 1}.jpg`);
      try {
        await downloadAndSave(u, dest);
        saved++;
      } catch (e) {
        // tenta próxima url
      }
    }

    if (saved >= 5) { report.real.push(id); console.log(`OK   ${id}: 5/5 fotos reais  [${query}]`); }
    else if (saved >= 1) { report.partial.push(`${id}(${saved})`); console.log(`~~   ${id}: ${saved}/5 reais + placeholder  [${query}]`); }
    else { report.placeholder.push(id); console.log(`--   ${id}: 0 fotos, mantido placeholder  [${query}]`); }

    await sleep(250);
  }

  console.log('\n========== RESUMO ==========');
  console.log(`5/5 reais:      ${report.real.length} produtos`);
  console.log(`parciais:       ${report.partial.length} -> ${report.partial.join(', ')}`);
  console.log(`só placeholder: ${report.placeholder.length} -> ${report.placeholder.join(', ')}`);
})();
