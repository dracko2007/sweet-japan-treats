// Função serverless (Vercel) — envia e-mails pela conta Zoho (contato@japanexpress-store.com).
// A senha fica SÓ no servidor (process.env.ZOHO_MAIL_PASSWORD). Nunca no código/navegador.
// Os corpos são montados a partir de TEMPLATES aqui (o cliente não envia HTML livre,
// para o endpoint não virar um relay de spam).
import nodemailer from 'nodemailer';

const FROM = 'contato@japanexpress-store.com';
const BRAND = 'Japan Express';

const wrap = (inner) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#ec4899,#f59e0b);padding:20px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px">🌸 ${BRAND}</h1>
      <p style="margin:4px 0 0;font-size:12px;opacity:.9">Importados do Japão</p>
    </div>
    <div style="padding:24px;color:#333;font-size:15px;line-height:1.6">${inner}</div>
    <div style="padding:14px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee">
      ${BRAND} · contato@japanexpress-store.com · japanexpress-store.com
    </div>
  </div>`;

function buildTemplate(type, name, code) {
  const hi = name ? `Olá, <strong>${name}</strong>!` : 'Olá!';
  if (type === '2fa') {
    return {
      subject: `Seu código de verificação: ${code}`,
      html: wrap(`${hi}<br><br>Seu código de verificação é:
        <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#ec4899;text-align:center;margin:18px 0">${code}</div>
        Ele expira em alguns minutos. Se você não solicitou, ignore este e-mail.`),
    };
  }
  // welcome / confirmação de cadastro
  return {
    subject: `Cadastro confirmado — Bem-vindo(a) à ${BRAND}! 🌸`,
    html: wrap(`${hi}<br><br>Seu cadastro na <strong>${BRAND}</strong> foi confirmado com sucesso! 🎉<br><br>
      Já pode aproveitar nossos importados do Japão, com frete seguro e suas vantagens de cliente.<br><br>
      <a href="https://japanexpress-store.com/produtos" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">Explorar a loja →</a><br><br>
      Qualquer dúvida, é só responder este e-mail. 💬`),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const pass = process.env.ZOHO_MAIL_PASSWORD;
  if (!pass) { res.status(503).json({ error: 'Email not configured' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const to = String(body.to || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { res.status(400).json({ error: 'invalid email' }); return; }

    const { subject, html } = buildTemplate(body.type, String(body.name || ''), String(body.code || ''));

    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.jp',
      port: 465,
      secure: true,
      auth: { user: FROM, pass },
    });

    await transporter.sendMail({ from: `"${BRAND}" <${FROM}>`, to, subject, html });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[send-email]', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}
