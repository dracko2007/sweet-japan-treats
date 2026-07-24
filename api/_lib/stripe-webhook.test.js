import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fulfillOrder: vi.fn(),
  markFulfillmentReview: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('./fulfillment.js', () => ({
  fulfillOrder: mocks.fulfillOrder,
  markFulfillmentReview: mocks.markFulfillmentReview,
}));
vi.mock('./mailer.js', () => ({
  buildOrderEmail: () => ({ subject: 'Order', html: '<p>Order</p>' }),
  sendMail: mocks.sendMail,
}));
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          id: 'SE-BR-123456',
          data: () => ({
            orderNumber: 'SE-BR-123456',
            customerEmail: 'buyer@example.com',
            currency: 'JPY',
            totalPrice: 1000,
            stripePaymentIntentId: 'pi_test',
          }),
        }),
      }),
    }),
  }),
}));

const { default: webhook } = await import('../stripe-webhook.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

const previousKey = process.env.STRIPE_SECRET_KEY;
const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  mocks.fulfillOrder.mockReset().mockResolvedValue({ replay: false });
  mocks.markFulfillmentReview.mockReset().mockResolvedValue(undefined);
  mocks.sendMail.mockReset().mockResolvedValue({});
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousKey;
  if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
});

function eventPayload() {
  return JSON.stringify({
    id: 'evt_test',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test',
        object: 'payment_intent',
        amount_received: 1000,
        currency: 'jpy',
        metadata: { orderId: 'SE-BR-123456' },
      },
    },
  });
}

describe('Stripe webhook signature boundary', () => {
  it('rejects an invalid signature without fulfilling the order', async () => {
    const res = response();
    await webhook({ method: 'POST', headers: { 'stripe-signature': 'invalid' }, body: Buffer.from(eventPayload()) }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_stripe_signature' });
    expect(mocks.fulfillOrder).not.toHaveBeenCalled();
  });

  it('verifies the unmodified payload and fulfills a matching intent', async () => {
    const payload = eventPayload();
    const stripe = new Stripe('sk_test_placeholder');
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
    const res = response();
    await webhook({ method: 'POST', headers: { 'stripe-signature': signature }, body: Buffer.from(payload) }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, replay: false });
    expect(mocks.fulfillOrder).toHaveBeenCalledWith('SE-BR-123456', {
      provider: 'stripe',
      reference: 'pi_test',
      confirmedBy: 'stripe-webhook',
    });
  });
});
