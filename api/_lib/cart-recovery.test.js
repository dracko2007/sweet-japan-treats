// O estágio 2 da recuperação prometia o cupom `VOLTA10`, que nunca existiu no
// Firestore: o cliente recebia o e-mail, digitava o código e tomava erro no
// checkout. O código do cupom agora é gerado junto com o envio, então essa
// classe de falha some — e estes testes existem para que ela não volte.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  set: vi.fn(),
  getUser: vi.fn(),
  docs: [],
  cupomExistente: undefined,
}));

vi.mock('./auth.js', () => ({ requireCronSecret: vi.fn() }));

vi.mock('./firebase-admin.js', () => ({
  adminAuth: () => ({ getUser: mocks.getUser }),
  adminDb: () => ({
    collection: () => ({
      // `garantirCupom` lê o documento antes de gravar, para acumular os
      // e-mails já autorizados. Sem cupom prévio, devolve vazio.
      doc: () => ({ set: mocks.set, get: async () => ({ data: () => mocks.cupomExistente }) }),
      where: () => ({ limit: () => ({ get: async () => ({ docs: mocks.docs, size: mocks.docs.length }) }) }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({ data: () => ref.__dados }),
      update: () => {},
    }),
  }),
}));

vi.mock('./mailer.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendMail: mocks.sendMail,
}));

const { default: handler } = await import('../cart-recovery.js');

function resposta() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(n, v) { this.headers[n] = v; },
    status(c) { this.statusCode = c; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; },
  };
}

/** Carrinho abandonado há `horas`, já tendo recebido `estagio` lembretes. */
function carrinho(horas, estagio) {
  const dados = {
    abandonedAt: Date.now() - horas * 3600000,
    reminderStage: estagio,
    items: [{ name: 'Pocky', quantity: 2 }],
  };
  const ref = { __dados: dados, update: vi.fn().mockResolvedValue(undefined) };
  return { id: 'uid1', ref, data: () => dados };
}

async function rodar(horas, estagio) {
  mocks.docs = [carrinho(horas, estagio)];
  const res = resposta();
  await handler({ method: 'GET', headers: {} }, res);
  return res;
}

describe('recuperação de carrinho', () => {
  beforeEach(() => {
    mocks.sendMail.mockReset().mockResolvedValue({ accepted: ['x'] });
    mocks.set.mockReset().mockResolvedValue(undefined);
    mocks.getUser.mockReset().mockResolvedValue({ email: 'cliente@exemplo.com', displayName: 'Ana' });
    mocks.cupomExistente = undefined;
  });

  it('primeiro toque não queima desconto', async () => {
    await rodar(2, 0); // 2h, nenhum lembrete ainda

    expect(mocks.set).not.toHaveBeenCalled();          // nenhum cupom criado
    const html = mocks.sendMail.mock.calls[0][0].html;
    expect(html).not.toMatch(/desconto/i);
  });

  it('oferece 30% só no último toque, a 7 dias', async () => {
    await rodar(24 * 8, 3); // 8 dias, já recebeu os 3 primeiros

    const cupom = mocks.set.mock.calls[0][0];
    expect(cupom.discountPercent).toBe(30);
    const { subject, html } = mocks.sendMail.mock.calls[0][0];
    expect(subject).toMatch(/30% OFF/);
    expect(html).toContain(cupom.code);
  });

  it('o cupom é criado ANTES de prometer o código no e-mail', async () => {
    await rodar(24 * 8, 3);

    // Era exatamente o bug do VOLTA10: e-mail com código que não existia.
    const ordemCriacao = mocks.set.mock.invocationCallOrder[0];
    const ordemEnvio = mocks.sendMail.mock.invocationCallOrder[0];
    expect(ordemCriacao).toBeLessThan(ordemEnvio);
  });

  it('o cupom vale para o CARRINHO INTEIRO, não para um produto', async () => {
    await rodar(24 * 8, 3);

    const c = mocks.set.mock.calls[0][0];
    // Campanha de produto carrega `productId` e o servidor a restringe a ele.
    // O cupom de recuperação não tem — incide sobre o pedido todo.
    expect(c.productId).toBeUndefined();
    expect(c.type).toBe('percent');
  });

  it('usa código fixo e legível, liberado só para quem recebeu o e-mail', async () => {
    await rodar(24 * 8, 3);

    const c = mocks.set.mock.calls[0][0];
    expect(c.code).toBe('CARRINHO30');
    // "CARRINHO30" é trivial de adivinhar; o que protege é a lista de alvos.
    expect(c.targetEmails).toContain('cliente@exemplo.com');
    // 'specific' e o unico valor que o servidor reconhece
    // (api/orders.js:resolveCoupon) e que `checkTargetEligibility` filtra.
    // Qualquer outra string cai no `return true` final e libera o cupom para
    // TODO MUNDO — foi exatamente o engano cometido aqui com 'email'.
    expect(c.targetType).toBe('specific');
  });

  it('o prazo acompanha o envio — 24h para finalizar', async () => {
    await rodar(24 * 8, 3);

    const c = mocks.set.mock.calls[0][0];
    const horas = (new Date(c.expiryDate).getTime() - Date.now()) / 3600000;
    expect(horas).toBeGreaterThan(23);
    expect(horas).toBeLessThan(25);
  });

  it('não envia nada se o cupom não puder ser criado', async () => {
    mocks.set.mockRejectedValue(new Error('firestore fora'));

    const res = await rodar(24 * 8, 3);

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(res.body.sent).toBe(0);
  });

  it('não avança de estágio antes da hora', async () => {
    await rodar(1, 0); // 1h < 90min do estágio 1

    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
