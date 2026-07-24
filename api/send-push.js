import { requireAdmin } from './_lib/auth.js';
import {
  assertExactKeys,
  handleCors,
  HttpError,
  normalizeEmail,
  optionalText,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { sendPush } from './_lib/push.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;

  try {
    const admin = await requireAdmin(req);
    await enforceRateLimit(req, {
      scope: 'send-push',
      limit: 30,
      windowMs: 60 * 60 * 1000,
      identity: admin.uid,
    });

    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['emails', 'title', 'body', 'url', 'tag']);
    if (!Array.isArray(body.emails) || body.emails.length < 1 || body.emails.length > 500) {
      throw new HttpError(400, 'invalid_recipients');
    }
    const emails = body.emails.map(normalizeEmail);
    const result = await sendPush({
      emails,
      title: requiredText(body.title, { max: 100 }),
      body: requiredText(body.body, { max: 300 }),
      url: optionalText(body.url, { max: 500 }) || '/',
      tag: optionalText(body.tag, { max: 50 }) || 'promo',
    });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[send-push]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
