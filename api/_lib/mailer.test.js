// Contrato do envio de e-mail pela API do Resend: nunca reportar sucesso sem o
// aceite da API, e traduzir falhas de credencial e de destinatário em códigos
// que o painel entende.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

const { sendMail, unsubscribeUrl, wrapEmail, MAIL_FROM } = await import('./mailer.js');

const CARTA = { to: 'cliente@exemplo.com', subject: 'Confirme seu e-mail', html: '<p>oi</p>' };

const resposta = (status, corpo) => new Response(JSON.stringify(corpo), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const enviado = () => JSON.parse(fetchMock.mock.calls.at(-1)[1].body);

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(resposta(200, { id: 're_123' }));
  vi.stubGlobal('fetch', fetchMock);
  process.env.RESEND_API_KEY = 're_chave_de_teste';
  process.env.UNSUBSCRIBE_SECRET = 'segredo-de-teste';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
});

describe('sendMail via API do Resend', () => {
  it('envia para a API do Resend com a chave e o remetente da loja', async () => {
    await sendMail(CARTA);

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers.Authorization).toBe('Bearer re_chave_de_teste');
    expect(enviado().from).toContain(MAIL_FROM);
    expect(enviado().to).toEqual(['cliente@exemplo.com']);
  });

  it('devolve o aceite e o id da mensagem quando a API aceita', async () => {
    const r = await sendMail(CARTA);

    expect(r.accepted).toEqual(['cliente@exemplo.com']);
    expect(r.rejected).toEqual([]);
    expect(r.messageId).toBe('re_123');
  });

  it('falha sem chamar a API quando falta RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendMail(CARTA)).rejects.toMatchObject({ statusCode: 503, code: 'email_not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('chave inválida ou domínio não verificado chega como email_auth_failed', async () => {
    fetchMock.mockResolvedValue(resposta(403, { name: 'validation_error', message: 'The domain is not verified' }));

    await expect(sendMail(CARTA)).rejects.toMatchObject({ statusCode: 503, code: 'email_auth_failed' });
  });

  it('chave recusada (401) também chega como email_auth_failed', async () => {
    fetchMock.mockResolvedValue(resposta(401, { name: 'missing_api_key', message: 'Missing API key' }));

    await expect(sendMail(CARTA)).rejects.toMatchObject({ code: 'email_auth_failed' });
  });

  it('destinatário recusado pela API (422) falha, não reporta sucesso', async () => {
    fetchMock.mockResolvedValue(resposta(422, { name: 'validation_error', message: 'Invalid to field' }));

    await expect(sendMail(CARTA)).rejects.toMatchObject({ statusCode: 502, code: 'email_rejected_by_smtp' });
  });

  it('resposta 200 sem id não é tratada como envio', async () => {
    fetchMock.mockResolvedValue(resposta(200, {}));

    await expect(sendMail(CARTA)).rejects.toMatchObject({ statusCode: 502, code: 'email_provider_error' });
  });

  it('falha de rede sobe como ele mesmo', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendMail(CARTA)).rejects.toThrow(/fetch failed/);
  });
});

describe('alternativa em texto puro', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(resposta(200, { id: 're_x' }));
  });

  it('acompanha o HTML em toda mensagem', async () => {
    await sendMail({ ...CARTA, html: '<p>Ola, <strong>Maria</strong>.</p>' });

    const { text, html } = enviado();
    expect(text).toBeTruthy();
    expect(html).toBeTruthy();
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain('Ola, Maria.');
  });

  // Sem isto o e-mail de confirmação chega vazio para quem lê em texto puro:
  // o botão vira uma palavra solta e o link some.
  it('preserva a URL de confirmação, não só o rótulo do botão', async () => {
    const link = 'https://japanexpress-store.com/__/auth/action?mode=verifyEmail&oobCode=ABC123';
    await sendMail({ ...CARTA, html: `<p><a href="${link}">Confirmar meu e-mail</a></p>` });

    const { text } = enviado();
    expect(text).toContain(link);
    expect(text).toContain('Confirmar meu e-mail');
  });
});

// O rodapé é a única saída de quem não tem conta na loja (lead capturado no
// popup de saída) ou não lembra da senha. Sem ele, o caminho que sobra é marcar
// como spam — e num domínio novo isso derruba a entrega de tudo, inclusive a
// confirmação de pedido.
describe('cancelamento de inscrição', () => {
  const ENDERECO = 'cliente@exemplo.com';

  beforeEach(() => {
    fetchMock.mockResolvedValue(resposta(200, { id: 're_x' }));
  });

  it('o link do rodapé chega inteiro, inclusive em texto puro', async () => {
    const url = unsubscribeUrl(ENDERECO);

    await sendMail({ ...CARTA, html: wrapEmail('<p>oferta</p>', { unsubscribeUrl: url }), unsubscribe: url });

    const { html, text } = enviado();
    expect(html).toContain(url.replace(/&/g, '&amp;'));
    expect(text).toContain('Cancelar inscricao');
    expect(text).toContain(url);
  });

  // É o que faz o Gmail e o Outlook mostrarem o botão nativo ao lado do
  // remetente — o caminho que a maioria usa, em vez de rolar até o rodapé.
  it('anuncia o cancelamento em um clique (RFC 8058)', async () => {
    const url = unsubscribeUrl(ENDERECO);

    await sendMail({ ...CARTA, html: '<p>oferta</p>', unsubscribe: url });

    const { headers } = enviado();
    expect(headers['List-Unsubscribe']).toBe(`<${url}>`);
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  // Confirmação de pedido, rastreio e redefinição de senha não são divulgação:
  // a loja precisa mandar de qualquer forma. Oferecer "cancelar inscrição"
  // neles prometeria algo que não dá para cumprir.
  it('e-mail transacional não ganha rodapé nem cabeçalho', async () => {
    await sendMail({ ...CARTA, html: wrapEmail('<p>Pedido recebido</p>') });

    const corpo = enviado();
    expect(corpo.html).not.toMatch(/cancelar inscricao/i);
    expect(corpo.headers).toBeUndefined();
  });
});
