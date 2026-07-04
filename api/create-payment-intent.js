// Serverless endpoint — creates a Stripe PaymentIntent for card checkout.
// Amount/currency are recomputed server-side from orderId+total sent by the
// client; Stripe secret key never reaches the browser.
import Stripe from 'stripe';

const MIN_CHARGE_BY_CURRENCY = { BRL: 1, EUR: 0.5, USD: 0.5 };

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

    const validCurrencies = ['BRL', 'EUR', 'USD'];
    if (!validCurrencies.includes(currency)) {
      res.status(400).json({ error: 'invalid currency' });
      return;
    }
    const minAmount = MIN_CHARGE_BY_CURRENCY[currency];
    if (!Number.isFinite(amount) || amount < minAmount) {
      res.status(400).json({ error: 'invalid amount' });
      return;
    }

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses smallest currency unit (cents)
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: orderId ? { orderId } : undefined,
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error('[create-payment-intent]', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}
