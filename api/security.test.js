import { afterEach, describe, expect, it } from 'vitest';
import confirmManualPayment from './confirm-manual-payment.js';
import createOrder from './create-order.js';
import cartRecovery from './cart-recovery.js';
import promoCampaign from './promo-campaign.js';
import sendEmail from './send-email.js';
import sendPush from './send-push.js';
import { requireUser } from './_lib/auth.js';

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

const previousCronSecret = process.env.CRON_SECRET;
afterEach(() => {
  if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousCronSecret;
});

describe('server API security boundaries', () => {
  it('returns 401 for a missing bearer token before touching Firebase', async () => {
    await expect(requireUser({ headers: {} })).rejects.toMatchObject({ statusCode: 401, code: 'unauthorized' });
  });

  it('fails a cron closed when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = response();
    await cartRecovery({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'cron_not_configured' });
  });

  it('rejects arbitrary transactional HTML instead of relaying it', async () => {
    const res = response();
    await sendEmail({
      method: 'POST',
      headers: {},
      body: { type: 'transactional', to: 'victim@example.com', subject: 'x', html: '<script>alert(1)</script>' },
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'unsupported_email_type' });
  });

  it('requires admin authentication for push and campaign dispatch', async () => {
    const pushRes = response();
    await sendPush({ method: 'POST', headers: {}, body: {} }, pushRes);
    expect(pushRes.statusCode).toBe(401);

    const campaignRes = response();
    await promoCampaign({ method: 'POST', headers: {}, body: {} }, campaignRes);
    expect(campaignRes.statusCode).toBe(401);
  });

  it('requires authentication before creating or confirming an order', async () => {
    const createRes = response();
    await createOrder({ method: 'POST', headers: {}, body: {} }, createRes);
    expect(createRes.statusCode).toBe(401);

    const confirmRes = response();
    await confirmManualPayment({ method: 'POST', headers: {}, body: {} }, confirmRes);
    expect(confirmRes.statusCode).toBe(401);
  });
});
