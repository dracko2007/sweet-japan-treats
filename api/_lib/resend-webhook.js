import { createHmac, timingSafeEqual } from 'node:crypto';

// Resend entrega webhooks no padrão Svix: assina `${svix-id}.${svix-timestamp}.${corpo}`
// com HMAC-SHA256. O segredo vem como `whsec_<base64>` e a chave é o base64 decodificado.
// `svix-signature` pode trazer várias assinaturas separadas por espaço (`v1,<base64>`)
// durante a rotação do segredo.
const TOLERANCIA_SEGUNDOS = 5 * 60;

export function assinaturaResendValida({ bytes, id, timestamp, assinatura, segredo, agoraSegundos }) {
  if (!id || !timestamp || !assinatura || !segredo) return false;

  const instante = Number(timestamp);
  if (!Number.isInteger(instante) || Math.abs(agoraSegundos - instante) > TOLERANCIA_SEGUNDOS) return false;

  const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64');
  const esperada = createHmac('sha256', chave).update(`${id}.${timestamp}.`).update(bytes).digest();

  return assinatura.split(' ').some((parte) => {
    if (!parte.startsWith('v1,')) return false;
    const recebida = Buffer.from(parte.slice(3), 'base64');
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}
