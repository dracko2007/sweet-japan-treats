// Serverless endpoint — creates a Stripe PaymentIntent for card checkout.
// Amount/currency are recomputed server-side from orderId+total sent by the
// client; Stripe secret key never reaches the browser.
import Stripe from 'stripe';

// Currencies the store presents at checkout (Japão=JPY é o mercado principal).
// JPY is zero-decimal: Stripe expects the amount as-is, WITHOUT multiplying by 100.
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);

// Stripe minimum charge per currency (in the presentment/major unit).
// https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts
const MIN_CHARGE_BY_CURRENCY = { JPY: 50, BRL: 0.5, EUR: 0.5, USD: 0.5 };

// Recibos SEMPRE em inglês, independente da moeda do pedido. O idioma do recibo
// de um PaymentIntent segue o preferred_locales do Customer; forçamos 'en'.
// https://docs.stripe.com/receipts
const RECEIPT_LOCALE = 'en';

// Anexa (ou cria) um Customer com locale inglês para garantir recibo em EN.
// Falha aqui nunca deve impedir o pagamento — retorna null e seguimos sem customer.
async function getEnglishCustomerId(stripe, email, name) {
  if (!email) return null;
  try {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      const cust = existing.data[0];
      await stripe.customers.update(cust.id, { preferred_locales: [RECEIPT_LOCALE] });
      return cust.id;
    }
    const created = await stripe.customers.create({
      email,
      name: name || undefined,
      preferred_locales: [RECEIPT_LOCALE],
    });
    return created.id;
  } catch (e) {
    console.error('[create-payment-intent] customer step failed', e);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const amount = Number(body.amount);
    const currency = String(body.currency || '').toUpperCase();
    const orderId = String(body.orderId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();

    const validCurrencies = Object.keys(MIN_CHARGE_BY_CURRENCY);
    if (!validCurrencies.includes(currency)) {
      res.status(400).json({ error: 'invalid currency' });
      return;
    }
    const minAmount = MIN_CHARGE_BY_CURRENCY[currency];
    if (!Number.isFinite(amount) || amount < minAmount) {
      res.status(400).json({ error: 'invalid amount' });
      return;
    }

    // Stripe amounts are always in the currency's smallest unit. Zero-decimal
    // currencies (JPY) take the integer amount directly; others are ×100 (cents).
    const stripeAmount = ZERO_DECIMAL_CURRENCIES.has(currency)
      ? Math.round(amount)
      : Math.round(amount * 100);

    const stripe = new Stripe(secretKey);
    const customerId = await getEnglishCustomerId(stripe, email, name);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      // Recibo automático do Stripe é enviado a este e-mail (em inglês via customer locale).
      receipt_email: email || undefined,
      customer: customerId || undefined,
      metadata: orderId ? { orderId } : undefined,
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error('[create-payment-intent]', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}
