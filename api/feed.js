// Feed de catálogo para indexadores (Google Merchant / Shopping).
// Gera o preço TOTAL estimado = preço do produto + frete pelo peso.
// Frete usa o peso real (weightGrams) arredondado para a faixa do Japan Post.
//
// Uso:
//   /api/feed              → XML Google Merchant, destino Brasil (BRL+¥)
//   /api/feed?region=eu    → XML Google Merchant, destino Europa (EUR+¥)
//   /api/feed?format=json  → JSON com os mesmos dados
//
// Produtos são públicos no Firestore (allow read: if true) — lê via REST sem auth.

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const SITE_URL = 'https://www.japanexpress-store.com';

// Taxa fixa de fallback (mesma base do fxService) — feed precisa ser determinístico.
// ¥→BRL ≈ 1/28, ¥→EUR ≈ 0.16/28. Cushion de 6% para cobrir variação cambial.
const FX = {
  BRL: { rate: 1 / 28, cushion: 0.06, symbol: 'BRL' },
  EUR: { rate: 0.16 / 28, cushion: 0.06, symbol: 'EUR' },
};
const BUFFER_YEN = 5;

function convertYen(yen, region) {
  const fx = region === 'eu' ? FX.EUR : FX.BRL;
  return Math.round((yen + BUFFER_YEN) * fx.rate * (1 + fx.cushion) * 100) / 100;
}

// ── Tabelas Japan Post (mesmos dados de src/utils/japanPostRates.ts) ─────────
// Zona 3 = Europa, Zona 5 = Brasil
const E_LIGHT = {
  3: [880,1060,1240,1420,1600,1780,1960,2140,2320,2500,2680,2860,3040,3220,3400,3580,3760,3940,4120,4300],
  5: [920,1180,1440,1700,1960,2220,2480,2740,3000,3260,3520,3780,4040,4300,4560,4820,5080,5340,5600,5860],
};
const AIR_PARCEL = {
  3: [3850,6000,8150,10300,12450,14600,16750,18900,21050,23200,24800,26400,28000,29600,31200,32800,34400,36000,37600,39200,40800,42400,44000,45600,47200,48800,50400,52000,53600,55200],
  5: [4550,7250,9950,12650,15350,18050,20750,23450,26150,28850,30650,32450,34250,36050,37850,39650,41450,43250,45050,46850,48650,50450,52250,54050,55850,57650,59450,61250,63050,64850],
};

function getELightRate(weightG, zone) {
  if (weightG <= 0 || weightG > 2000) return null;
  return E_LIGHT[zone][Math.ceil(weightG / 100) - 1] ?? null;
}
function getAirParcelRate(weightG, zone) {
  if (weightG <= 0 || weightG > 30000) return null;
  return AIR_PARCEL[zone][Math.min(Math.ceil(weightG / 1000) - 1, 29)] ?? null;
}

// Frete mais barato disponível para o peso (¥). Peso é o real do produto + overhead.
function cheapestShippingYen(weightG, zone) {
  const billable = Math.max(100, weightG); // peso real já cadastrado
  const opts = [];
  const eLight = getELightRate(billable, zone);
  if (eLight != null) opts.push(eLight);
  const air = getAirParcelRate(billable, zone);
  if (air != null) opts.push(air);
  return opts.length ? Math.min(...opts) : null;
}

// ── Lógica de preço do produto (espelha src/utils/pricing.ts) ────────────────
function getVariants(p) {
  if (Array.isArray(p.variants) && p.variants.length) return p.variants;
  return [
    { id: 'small', label: 'Pequeno', price: p.prices?.small || 0 },
    { id: 'large', label: 'Grande', price: p.prices?.large || p.prices?.small || 0 },
  ].filter(v => v.price > 0);
}
function minEffectiveYen(p) {
  const vs = getVariants(p);
  if (!vs.length) return 0;
  const disc = p.discountPercent > 0 ? (1 - p.discountPercent / 100) : 1;
  return Math.min(...vs.map(v => Math.round(v.price * disc)));
}

// Peso usado para frete: weightGrams real, ou estimativa por tamanho
function productWeightG(p) {
  if (p.weightGrams && p.weightGrams > 0) return p.weightGrams;
  return 500; // base padrão
}

// ── Leitura de produtos do Firestore via REST ────────────────────────────────
async function fetchProducts() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300`;
  const all = [];
  let pageToken = '';
  do {
    const res = await fetch(pageToken ? `${url}&pageToken=${pageToken}` : url);
    if (!res.ok) throw new Error('Firestore read failed: ' + res.status);
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const id = doc.name.split('/').pop();
      all.push({ id, ...parseFirestoreFields(doc.fields || {}) });
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return all;
}

// Converte o formato de campos do Firestore REST para objeto JS plano
function parseFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
  return out;
}
function parseValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue' in v) return parseFirestoreFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('nullValue' in v) return null;
  return undefined;
}

function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// ── Monta os itens do catálogo ───────────────────────────────────────────────
function buildCatalog(products, region) {
  const zone = region === 'eu' ? 3 : 5;
  const currency = region === 'eu' ? 'EUR' : 'BRL';

  return products
    .filter(p => {
      if (p.hidden) return false;
      // Produtos "exterior-only" não vendem no Japão → ok para feed BR/EU
      // Produtos "japan-only" não devem aparecer no feed internacional
      if (p.deliveryRestrict === 'japan-only') return false;
      return getVariants(p).length > 0;
    })
    .map(p => {
      const productYen = minEffectiveYen(p);
      if (!productYen) return null;

      // Imagem: só URLs http(s) válidas. Google rejeita base64/data-URI e WebP.
      // Procura a primeira imagem que seja URL http (ignora base64 salvo no Firestore).
      const candidates = [p.image, p.thumbnail, ...(p.gallery || [])].filter(Boolean);
      let image = candidates.find(u => typeof u === 'string' && /^https?:\/\//.test(u)) || '';
      if (image.includes('res.cloudinary.com')) {
        image = image.replace(/\/upload\/[^/]*\//, '/upload/f_jpg,q_auto/');
      }
      if (!image) return null; // sem URL http válida → fora do feed

      const weightG = productWeightG(p);
      const shipYen = cheapestShippingYen(weightG, zone) || 0;
      const totalYen = productYen + shipYen;

      return {
        id: p.id,
        title: p.name.slice(0, 150),
        description: (p.description || p.name).slice(0, 5000),
        link: `${SITE_URL}/produto/${p.id}`,
        image,
        availability: (p.stock && !p.stock.unlimited && p.stock.quantity === 0) ? 'out_of_stock' : 'in_stock',
        condition: 'new',
        brand: 'Japan Express',
        weightG,
        priceYen: productYen,
        shippingYen: shipYen,
        totalYen,
        priceLocal: convertYen(productYen, region),
        shippingLocal: convertYen(shipYen, region),
        totalLocal: convertYen(totalYen, region),
        currency,
      };
    })
    .filter(Boolean);
}

// ── Saída XML (Google Merchant RSS 2.0 + namespace g:) ───────────────────────
// title/description/link usam RSS padrão; campos próprios do Google usam g:
// google_product_category 469 = Health & Beauty; identifier_exists=no porque
// produtos importados não têm GTIN/MPN cadastrado.
function toXml(items, region) {
  const title = region === 'eu' ? 'Japan Express — Catálogo (Europa)' : 'Japan Express — Catálogo (Brasil)';
  const country = region === 'eu' ? 'PT' : 'BR';
  const entries = items.map(it => `
    <item>
      <g:id>${escapeXml(it.id)}</g:id>
      <title>${escapeXml(it.title)}</title>
      <description>${escapeXml(it.description)}</description>
      <link>${escapeXml(it.link)}</link>
      <g:image_link>${escapeXml(it.image)}</g:image_link>
      <g:availability>${it.availability}</g:availability>
      <g:condition>new</g:condition>
      <g:price>${it.priceLocal.toFixed(2)} ${it.currency}</g:price>
      <g:brand>${escapeXml(it.brand)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>469</g:google_product_category>
      <g:shipping>
        <g:country>${country}</g:country>
        <g:service>Japan Post</g:service>
        <g:price>${it.shippingLocal.toFixed(2)} ${it.currency}</g:price>
      </g:shipping>
      <g:shipping_weight>${(it.weightG / 1000).toFixed(2)} kg</g:shipping_weight>
      <g:custom_label_0>${it.totalLocal.toFixed(2)} ${it.currency}</g:custom_label_0>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${SITE_URL}</link>
    <description>Produtos importados do Japão com preço e frete estimado por peso.</description>${entries}
  </channel>
</rss>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!FIREBASE_PROJECT_ID) {
    res.status(500).json({ error: 'FIREBASE_PROJECT_ID não configurado' });
    return;
  }

  const region = req.query.region === 'eu' ? 'eu' : 'br';
  const format = req.query.format === 'json' ? 'json' : 'xml';

  try {
    const products = await fetchProducts();
    const items = buildCatalog(products, region);

    // Cache 6h no CDN da Vercel — feed não precisa ser em tempo real
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({ region, count: items.length, items });
    } else {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.status(200).send(toXml(items, region));
    }
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
