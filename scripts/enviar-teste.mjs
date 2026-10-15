// Envia UMA mensagem real pelo mesmo caminho da produção (`api/_lib/mailer.js`,
// API do Resend), para conferir remetente, From visível e entrega depois de
// mexer em RESEND_API_KEY ou no domínio verificado.
//
//   node scripts/enviar-teste.mjs destino@exemplo.com
//
// Lê o .env local se existir (Vercel injeta em produção). Sem arquivo, usa as
// variáveis já exportadas no shell, por exemplo RESEND_API_KEY.
import { existsSync, readFileSync } from 'node:fs';

const envUrl = new URL('../.env', import.meta.url);
if (existsSync(envUrl)) {
  for (const linha of readFileSync(envUrl, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const destino = process.argv[2];
if (!destino) {
  console.error('Informe o destinatário.');
  process.exit(1);
}

const { sendMail, MAIL_FROM, MAIL_REPLY_TO } = await import('../api/_lib/mailer.js');

console.log(`From: ${MAIL_FROM} | Reply-To: ${MAIL_REPLY_TO}`);

const agora = new Date().toISOString();
try {
  const r = await sendMail({
    to: destino,
    subject: `Teste de envio da loja — ${agora}`,
    html: `<p>Mensagem de teste do <strong>Japan Express</strong>.</p>
<p>Se você está lendo isso, o Resend aceitou e entregou.</p>
<p>Confira no cabeçalho: o remetente precisa aparecer como <code>${MAIL_FROM}</code>.</p>
<p>Enviado em ${agora}.</p>`,
  });
  console.log('ENVIADO:', JSON.stringify(r));
} catch (erro) {
  console.log('FALHOU:', erro?.code || erro?.message, '| statusCode:', erro?.statusCode ?? '-');
  console.log('  detalhe:', String(erro?.message || '').split('\n')[0]);
  process.exitCode = 1;
}
