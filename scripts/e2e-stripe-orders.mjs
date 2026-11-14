// Teste ponta a ponta do checkout com cartão: cria 10 pedidos de convidado no
// ambiente apontado por E2E_BASE (um Preview da Vercel com chaves de TESTE do
// Stripe) e imprime, para cada um, o PaymentIntent a confirmar.
//
//   E2E_BASE=https://<preview>.vercel.app \
//   E2E_BYPASS=<segredo de bypass da proteção do Preview> \
//   node scripts/e2e-stripe-orders.mjs [saida.json]   # cria os 10 pedidos
//   node scripts/e2e-stripe-orders.mjs --stock        # só mostra o estoque atual dos produtos de teste
//
// Nada aqui lê ou imprime chave secreta. E-mails vão para `delivered+...@resend.dev`
// (sumidouro do Resend), então nenhum cliente real recebe mensagem. Os pedidos
// gravam no Firestore do projeto: o prefixo 999 no número os identifica como teste.
import { writeFileSync } from 'node:fs';

const BASE = (process.env.E2E_BASE || '').replace(/\/$/, '');
const BYPASS = process.env.E2E_BYPASS || '';
// Chave WEB do Firebase: pública por definição (está no bundle do site e em src/config/firebase.ts).
const FIREBASE_WEB_KEY = 'AIzaSyCKf6f9QqRk9VUPTzNr28gVEEn5sAdwr0g';
if (!BASE) { console.error('Defina E2E_BASE.'); process.exit(1); }

// CPF válido (dígitos verificadores corretos) a partir de 9 dígitos.
function cpfFrom(nine) {
  const d = String(nine).padStart(9, '0').split('').map(Number);
  const dv = (arr) => { const s = arr.reduce((a, n, i) => a + n * (arr.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(d); const d2 = dv([...d, d1]);
  return [...d, d1, d2].join('');
}

const BR = (extra = {}) => ({ country: 'Brasil', prefecture: '', state: 'SP', cep: '01310-100', city: 'São Paulo', address: 'Av. Paulista, 1000', building: 'Ap 42', ...extra });
const US = (extra = {}) => ({ country: 'Estados Unidos', prefecture: '', state: 'CA', cep: '90001', city: 'Los Angeles', address: '123 Main St', building: '', ...extra });
const JP = (extra = {}) => ({ country: 'Japão', prefecture: 'Hiroshima', state: '', cep: '720-1143', city: 'Fukuyama-shi', address: 'Ekiya-cho 257-18', building: '', ...extra });

// Produtos de teste com ESTOQUE CONTROLADO, criados no painel admin com o nome começando
// por "TESTE E2E". São descobertos no catálogo público, que também mostra o estoque:
// é assim que se confere a baixa feita pelo webhook, sem acesso direto ao banco.
const CATALOG = (process.env.E2E_CATALOG || 'https://www.japanexpress-store.com').replace(/\/$/, '');
async function loadTestProducts() {
  const res = await fetch(`${CATALOG}/api/products`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.products || data.items || []);
  return list.filter((p) => /TESTE E2E/i.test(p.name || '')).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
const stockOf = (p) => (p.stock?.unlimited === false ? Number(p.stock.quantity) : null);

const testProducts = await loadTestProducts();
if (process.argv[2] === '--stock') {
  for (const p of testProducts) console.log(`${p.id}\testoque=${stockOf(p)}`);
  process.exit(0);
}
if (testProducts.length < 3 || testProducts.some((p) => stockOf(p) === null)) {
  console.error('Crie no painel admin 3 ou mais produtos "TESTE E2E ..." com estoque controlado (não ilimitado).');
  process.exit(1);
}
const pid = (i) => testProducts[i % testProducts.length].id;
const vid = (i) => (testProducts[i % testProducts.length].variants?.[0]?.id) || 'small';
const stockBefore = Object.fromEntries(testProducts.map((p) => [p.id, stockOf(p)]));
console.log('Estoque antes:', JSON.stringify(stockBefore));
const P = { a: 0, b: 1, c: 2, d: 3 };

const SCENARIOS = [
  { n: 1, dest: BR(), prefix: 'SE-BR', carrier: 'ems', items: [[P.a, 1]], pm: 'pm_card_visa' },
  { n: 2, dest: BR(), prefix: 'SE-BR', carrier: 'eraito', items: [[P.b, 2]], pm: 'pm_card_mastercard' },
  { n: 3, dest: BR(), prefix: 'SE-BR', carrier: 'kozutsumi-air', items: [[P.c, 1], [P.a, 1]], pm: 'pm_card_visa_debit' },
  { n: 4, dest: BR(), prefix: 'SE-BR', carrier: 'ems', items: [[P.d, 3]], pm: 'pm_card_visa', waivePs: true },
  { n: 5, dest: BR(), prefix: 'SE-BR', carrier: 'eraito', items: [[P.b, 1], [P.c, 1]], pm: 'pm_card_mastercard' },
  { n: 6, dest: US(), prefix: 'SE-US', carrier: 'ems', items: [[P.a, 2]], pm: 'pm_card_visa' },
  { n: 7, dest: US(), prefix: 'SE-US', carrier: 'eraito', items: [[P.b, 1], [P.d, 1]], pm: 'pm_card_amex' },
  { n: 8, dest: JP(), prefix: 'SC-JP', carrier: 'yuubin', items: [[P.c, 1]], pm: 'pm_card_visa' },
  { n: 9, dest: JP(), prefix: 'SC-JP', carrier: 'yamato', items: [[P.a, 2], [P.d, 1]], pm: 'pm_card_mastercard', waivePs: true },
  { n: 10, dest: BR(), prefix: 'SE-BR', carrier: 'ems', items: [[P.b, 2], [P.c, 1]], pm: 'pm_card_visa' },
];

const headers = (extra = {}) => ({
  'content-type': 'application/json',
  ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}),
  ...extra,
});

async function call(path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(token ? { authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

async function guestIdToken() {
  const g = await call('/api/guest-token');
  if (!g.json?.token) throw new Error(`guest-token ${g.status} ${JSON.stringify(g.json).slice(0, 160)}`);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: g.json.token, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error(`signInWithCustomToken ${r.status} ${j.error?.message || ''}`);
  return j.idToken;
}

const results = [];
for (const s of SCENARIOS) {
  const orderId = `${s.prefix}-999${String(s.n).padStart(3, '0')}`;
  const email = `delivered+je-teste-${String(s.n).padStart(2, '0')}@resend.dev`;
  const row = { n: s.n, orderId, email, country: s.dest.country, carrier: s.carrier, pm: s.pm, waivePs: Boolean(s.waivePs) };
  try {
    const idToken = await guestIdToken();
    let psFeeWaiverToken;
    if (s.waivePs) {
      const w = await call('/api/ps-fee-waiver', { token: idToken });
      psFeeWaiverToken = w.json?.token;
      row.waiverIssued = Boolean(psFeeWaiverToken);
    }
    const body = {
      orderId,
      items: s.items.map(([i, quantity]) => ({ productId: pid(i), variantId: vid(i), quantity })),
      country: s.dest.country,
      prefecture: s.dest.prefecture,
      state: s.dest.state,
      shippingCarrier: s.carrier,
      paymentMethod: 'card',
      ...(psFeeWaiverToken ? { psFeeWaiverToken } : {}),
      customer: {
        name: `Cliente Teste ${String(s.n).padStart(2, '0')}`,
        email,
        phone: '+81 70 0000 0000',
        cpf: s.dest.country === 'Brasil' ? cpfFrom(100000000 + s.n * 7919) : '',
        postalCode: s.dest.cep,
        city: s.dest.city,
        address: s.dest.address,
        building: s.dest.building,
      },
    };
    const c = await call('/api/create-order', { token: idToken, body });
    if (c.status !== 201 || !c.json?.clientSecret) {
      row.error = `create-order ${c.status} ${JSON.stringify(c.json).slice(0, 200)}`;
    } else {
      row.paymentIntent = String(c.json.clientSecret).split('_secret_')[0];
      row.currency = c.json.order?.currency;
      row.total = c.json.order?.totalPrice ?? c.json.order?.total;
      row.psFee = c.json.order?.priceBreakdown?.psFee;
      row.psFeeGross = c.json.order?.priceBreakdown?.psFeeGross;
      row.psFeeWaiverApplied = c.json.order?.psFeeWaiverApplied;
    }
  } catch (error) {
    row.error = error instanceof Error ? error.message : String(error);
  }
  results.push(row);
  console.log(JSON.stringify(row));
}

const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.paymentIntent).length}/${results.length} pedidos criados`);
