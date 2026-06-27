// Sitemap dinâmico: páginas estáticas + TODOS os produtos (/produto/:id).
// Antes o sitemap era estático e não listava produtos — o Google não descobria as
// páginas que mais convertem. Produtos são públicos no Firestore (leitura REST sem auth).

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const SITE_ORIGIN = 'https://japanexpress-store.com';

async function fetchProducts() {
  const base = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300`;
  const all = [];
  let pageToken = '';
  do {
    const url = pageToken ? `${base}&pageToken=${pageToken}` : base;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Firestore read failed: ' + res.status);
    const data = await res.json();
    (data.documents || []).forEach(doc => {
      const id = doc.name.split('/').pop();
      all.push({ id, ...parseFields(doc.fields || {}) });
    });
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return all;
}

function parseFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
  return out;
}
function parseValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  return undefined;
}

function escapeXml(s) {
  return String(s || '').replace(/[<>&'\"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function toIso(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Páginas estáticas públicas. Rotas internas (checkout, perfil, admin...) não entram.
const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/produtos', priority: '0.9', changefreq: 'daily' },
  { loc: '/ofertas', priority: '0.8', changefreq: 'weekly' },
  { loc: '/frete', priority: '0.7', changefreq: 'monthly' },
  { loc: '/como-funciona', priority: '0.6', changefreq: 'monthly' },
  { loc: '/sobre', priority: '0.6', changefreq: 'monthly' },
  { loc: '/faca-seu-pedido', priority: '0.6', changefreq: 'monthly' },
  { loc: '/empresas', priority: '0.5', changefreq: 'monthly' },
  { loc: '/afiliado', priority: '0.5', changefreq: 'monthly' },
  { loc: '/rastrear', priority: '0.5', changefreq: 'monthly' },
  { loc: '/promocao', priority: '0.6', changefreq: 'weekly' },
  { loc: '/vlog', priority: '0.5', changefreq: 'weekly' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!FIREBASE_PROJECT_ID) {
    res.status(500).json({ error: 'FIREBASE_PROJECT_ID não configurado' });
    return;
  }

  try {
    const products = await fetchProducts();
    // Mesmo filtro do feed: escondidos e "japan-only" não entram no catálogo internacional
    const visible = products.filter(p => !p.hidden && p.deliveryRestrict !== 'japan-only');

    const staticUrls = STATIC_PAGES.map(p =>
      `  <url>\n    <loc>${SITE_ORIGIN}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    ).join('\n');

    const productUrls = visible.map(p =>
      `  <url>\n    <loc>${SITE_ORIGIN}/produto/${escapeXml(p.id)}</loc>\n    <lastmod>${toIso(p.updatedAt)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    ).join('\n');

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `${staticUrls}\n${productUrls}\n</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    // Cache 6h no CDN — o catálogo não muda a cada minuto
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}