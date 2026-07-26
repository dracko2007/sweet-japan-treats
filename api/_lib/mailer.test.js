// Contrato do envio de e-mail: nunca reportar sucesso sem entrega.
//
// O caso que motivou este arquivo: o SMTP aceita a conexão, recusa o
// destinatário, e o `sendMail` do nodemailer resolve normalmente com o
// endereço dentro de `rejected`. Sem checar isso, o endpoint respondia 200 e o
// cadastro do cliente ficava travado esperando um e-mail que nunca saiu — sem
// erro em lugar nenhum.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

const { sendMail } = await import('./mailer.js');

const CARTA = { to: 'cliente@exemplo.com', subject: 'Confirme seu e-mail', html: '<p>oi</p>' };

describe('sendMail', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    process.env.NOREPLY_EMAIL_PASSWORD = 'senha-de-teste';
  });

  it('devolve o resultado quando o destinatário é aceito', async () => {
    sendMailMock.mockResolvedValue({ accepted: ['cliente@exemplo.com'], rejected: [], messageId: '<abc@mail>' });

    const r = await sendMail(CARTA);

    expect(r.accepted).toEqual(['cliente@exemplo.com']);
    expect(r.messageId).toBe('<abc@mail>');
  });

  it('falha quando o SMTP recusa o destinatário', async () => {
    sendMailMock.mockResolvedValue({ accepted: [], rejected: ['cliente@exemplo.com'], messageId: '<abc@mail>' });

    await expect(sendMail(CARTA)).rejects.toMatchObject({ code: 'email_rejected_by_smtp' });
  });

  it('falha quando ninguém é aceito, mesmo sem recusa explícita', async () => {
    sendMailMock.mockResolvedValue({ accepted: [], rejected: [], messageId: '<abc@mail>' });

    await expect(sendMail(CARTA)).rejects.toMatchObject({ code: 'email_rejected_by_smtp' });
  });

  it('falha claramente quando falta a credencial de SMTP', async () => {
    delete process.env.NOREPLY_EMAIL_PASSWORD;
    delete process.env.GMAIL_APP_PASSWORD;

    await expect(sendMail(CARTA)).rejects.toMatchObject({ code: 'email_not_configured' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
