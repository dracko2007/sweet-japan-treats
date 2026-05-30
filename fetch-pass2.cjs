const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Segunda passada: produtos sem foto, com termos mais genéricos mas relevantes
const PRODUCTS = {
  'melano-cc':      ['cosmeticos', 'vitamin c serum bottle'],
  'senka-whip':     ['cosmeticos', 'facial cleanser foam'],
  'lululun-mask':   ['cosmeticos', 'facial sheet mask'],
  'keana-mask':     ['cosmeticos', 'face mask skincare'],
  'curel-cream':    ['cosmeticos', 'moisturizer cream'],
  'softymo-oil':    ['cosmeticos', 'makeup remover bottle'],
  'nerv-totebag':   ['acessorios', 'canvas tote bag'],
  'divoom-speaker': ['acessorios', 'bluetooth speaker'],
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
  for (const [id, [category, query]] of Object.entries(PRODUCTS)) {
    const dir = path.join(__dirname, 'public', 'images', category);
    let urls = [];
    try { urls = [...new Set(await searchOpenverse(query))]; }
    catch (e) { console.log(`!! ${id}: ${e.message}`); }

    let saved = 0;
    for (const u of urls) {
      if (saved >= 5) break;
      try { await downloadAndSave(u, path.join(dir, `${id}-${saved + 1}.jpg`)); saved++; }
      catch (e) {}
    }
    console.log(`${saved >= 1 ? 'OK' : '--'}   ${id}: ${saved}/5  [${query}]`);
    await sleep(250);
  }
  console.log('\nSegunda passada concluída.');
})();
