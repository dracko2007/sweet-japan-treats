// Decrementa o estoque de um produto via Firestore REST API com credenciais de admin.
// Necessário porque as regras de segurança do Firestore só permitem escrita do admin,
// e o SDK client-side não pode trocar de usuário no meio do fluxo de compra.

// Variáveis de ambiente server-only (sem prefixo VITE_ — não chegam ao browser)
// Configure no painel Vercel → Settings → Environment Variables (server-only)
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

async function getAdminToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Firebase auth failed: ' + (err.error?.message || res.status));
  }
  const data = await res.json();
  return data.idToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { productId, qty } = req.body || {};

  if (!productId || typeof qty !== 'number' || qty <= 0 || qty > 100) {
    return res.status(400).json({ error: 'productId and qty (1-100) are required' });
  }

  if (!ADMIN_PASSWORD) {
    // No credentials configured — skip silently (dev/test environment)
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    const token = await getAdminToken();

    const docName = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products/${productId}`;

    const commitRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          writes: [{
            transform: {
              document: docName,
              fieldTransforms: [
                {
                  fieldPath: 'stock.quantity',
                  increment: { integerValue: String(-qty) },
                },
                {
                  fieldPath: 'salesCount',
                  increment: { integerValue: String(qty) },
                },
              ],
            },
          }],
        }),
      }
    );

    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}));
      console.error('[decrement-stock] Firestore commit failed:', JSON.stringify(err));
      return res.status(500).json({ error: 'Firestore write failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[decrement-stock] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
