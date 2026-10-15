import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assinaturaResendValida } from './resend-webhook.js';

const SEGREDO = `whsec_${Buffer.from('segredo-de-teste-do-resend').toString('base64')}`;
const AGORA = 1_800_000_000;
const CORPO = Buffer.from('{"type":"email.bounced","data":{"email_id":"e1"}}');

function assinar(corpo, { id = 'msg_1', ts = String(AGORA), segredo = SEGREDO } = {}) {
  const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64');
  const sig = createHmac('sha256', chave).update(`${id}.${ts}.`).update(corpo).digest('base64');
  return { id, timestamp: ts, assinatura: `v1,${sig}` };
}

function verificar(corpo, cabecalhos) {
  return assinaturaResendValida({ bytes: corpo, segredo: SEGREDO, agoraSegundos: AGORA, ...cabecalhos });
}

describe('assinaturaResendValida', () => {
  it('aceita o corpo exato assinado com o segredo do webhook', () => {
    expect(verificar(CORPO, assinar(CORPO))).toBe(true);
  });

  it('rejeita o corpo com um byte alterado', () => {
    const cabecalhos = assinar(CORPO);
    expect(verificar(Buffer.from(CORPO.toString().replace('e1', 'e2')), cabecalhos)).toBe(false);
  });

  it('rejeita assinatura feita com outro segredo', () => {
    const cabecalhos = assinar(CORPO, { segredo: `whsec_${Buffer.from('outro').toString('base64')}` });
    expect(verificar(CORPO, cabecalhos)).toBe(false);
  });

  it('rejeita timestamp fora da tolerância de 5 minutos', () => {
    expect(verificar(CORPO, assinar(CORPO, { ts: String(AGORA - 301) }))).toBe(false);
  });

  it('aceita quando uma das assinaturas da lista é válida (rotação de segredo)', () => {
    const cabecalhos = assinar(CORPO);
    expect(verificar(CORPO, { ...cabecalhos, assinatura: `v1,AAAA ${cabecalhos.assinatura}` })).toBe(true);
  });

  it('rejeita cabeçalhos ausentes ou sem esquema v1', () => {
    const cabecalhos = assinar(CORPO);
    expect(verificar(CORPO, { ...cabecalhos, id: undefined })).toBe(false);
    expect(verificar(CORPO, { ...cabecalhos, assinatura: cabecalhos.assinatura.replace('v1,', 'v2,') })).toBe(false);
  });
});
