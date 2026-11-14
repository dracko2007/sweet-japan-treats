// Contrato do envio de e-mail pela API do Resend: nunca reportar sucesso sem o
// aceite da API, e traduzir falhas de credencial e de destinatário em códigos
// que o painel entende.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

const { sendMail, unsubscribeUrl, wrapEmail, buildOrderEmail, MAIL_FROM, MAIL_FROM_NOREPLY } = await import('./mailer.js');

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

  it('usa o remetente pedido quando informado (confirmação de cadastro sai do noreply)', async () => {
    await sendMail({ ...CARTA, from: MAIL_FROM_NOREPLY });

    expect(enviado().from).toBe(`"Japan Express" <${MAIL_FROM_NOREPLY}>`);
    expect(enviado().reply_to).toBe('contato@japanexpress-store.com');
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

describe('buildOrderEmail: a conta inteira do pedido', () => {
  // Pedido em reais com cupom, pontos, frete, taxa PS e PIX: as linhas fecham
  // o total (90 − 10 − 5 = 75; 75 + 40 + 12 + 0 + 3 = 130).
  const pedido = (extra = {}) => ({
    orderNumber: 'SE-BR-123456',
    customerName: 'Ana',
    customerEmail: 'ana@exemplo.com',
    currency: 'BRL',
    totalPrice: 130,
    paymentMethod: 'pix',
    couponCode: 'BEMVINDO',
    shippingCarrier: 'eraito',
    shippingAddress: { name: 'Ana', phone: '119999', postalCode: '01000-000', city: 'Sao Paulo', address: 'Rua A, 1', country: 'Brasil' },
    items: [
      { productName: 'Pocky', variantLabel: 'Kit 3 unidades', quantity: 2, price: 45 },
      { productName: 'Brinde KitKat', quantity: 1, price: 0, freeGift: true },
    ],
    priceBreakdown: {
      subtotal: 90, couponDiscount: 10, pointsDiscount: 5, paymentDiscount: 0, products: 75,
      shipping: 40, psFee: 12, importDuty: 0, paymentFee: 3, pixIof: 1, pixBankFee: 2, wiseYen: 0,
    },
    ...extra,
  });

  it('mostra itens, opção, brinde e cada linha da conta até o total', () => {
    const { html } = buildOrderEmail(pedido());
    expect(html).toContain('Pocky');
    expect(html).toContain('(Kit 3 unidades)');
    expect(html).toContain('Brinde');
    expect(html).toContain('Subtotal dos produtos');
    expect(html).toContain('Cupom BEMVINDO');
    expect(html).toContain('− R$ 10');
    expect(html).toContain('Pontos usados');
    expect(html).toContain('Frete (Air Packet / E-Light)');
    expect(html).toContain('R$ 40');
    expect(html).toContain('Taxa PS');
    expect(html).toContain('IOF do PIX');
    expect(html).toContain('Tarifa bancaria do PIX');
    expect(html).toContain('R$ 130');
    expect(html).toContain('Pagamento:</strong> PIX');
    expect(html).toContain('Rua A, 1');
  });

  it('esconde linhas zeradas e mostra o imposto dos EUA quando há', () => {
    const { html } = buildOrderEmail(pedido({
      currency: 'USD', paymentMethod: 'card', couponCode: '', totalPrice: 61.5,
      priceBreakdown: { subtotal: 30, couponDiscount: 0, pointsDiscount: 0, products: 30, shipping: 20, psFee: 6, importDuty: 5.5, paymentFee: 0, pixIof: 0, pixBankFee: 0 },
    }));
    expect(html).not.toContain('Cupom');
    expect(html).not.toContain('Pontos usados');
    expect(html).not.toContain('PIX');
    expect(html).toContain('Imposto de importacao dos EUA');
    expect(html).toContain('$5.50');
    expect(html).toContain('$61.50');
  });

  it('pedido Wise traz os ienes exatos para digitar, só para o cliente', () => {
    const wise = pedido({ paymentMethod: 'wise', priceBreakdown: { ...pedido().priceBreakdown, paymentFee: 0, pixIof: 0, pixBankFee: 0, wiseYen: 3456 } });
    expect(buildOrderEmail(wise).html).toContain('¥ 3,456');
    expect(buildOrderEmail(wise, { store: true }).html).not.toContain('¥ 3,456');
  });

  it('pedido antigo sem priceBreakdown continua com itens e total', () => {
    const { html } = buildOrderEmail(pedido({ priceBreakdown: undefined, currency: 'JPY', totalPrice: 5000 }));
    expect(html).toContain('Pocky');
    expect(html).toContain('¥5,000');
    expect(html).not.toContain('Subtotal dos produtos');
  });

  it('escapa o que veio do cliente', () => {
    const { html } = buildOrderEmail(pedido({
      customerName: '<script>x</script>',
      items: [{ productName: '<img src=x onerror=alert(1)>', variantLabel: '<b>', quantity: 1, price: 10 }],
      shippingAddress: { address: '"><svg onload=1>' },
    }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('(<b>)');
  });

  it('loja recebe contato do cliente; cliente não recebe o próprio contato repetido', () => {
    expect(buildOrderEmail(pedido(), { store: true }).html).toContain('ana@exemplo.com');
    expect(buildOrderEmail(pedido()).html).not.toContain('119999');
  });

  it('pedido local: a loja vê "enviar do Brasil" e o frete nacional; pedido do Japão não muda', () => {
    const local = pedido({ fulfillment: 'local', shipFrom: 'Brasil', shippingCarrier: 'local' });
    const loja = buildOrderEmail(local, { store: true });
    expect(loja.subject).toContain('(enviar do Brasil)');
    expect(loja.html).toContain('ENVIAR DO BRASIL');
    expect(loja.html).toContain('PAC (Correios)');
    expect(buildOrderEmail(local).html).toContain('Enviado direto do Brasil');
    const japao = buildOrderEmail(pedido(), { store: true });
    expect(japao.subject).not.toContain('enviar do');
    expect(japao.html).not.toContain('ENVIAR DO');
  });
});

describe('e-mail de envio detalhado (buildOrderEmail com tracking)', () => {
  const enviadoPedido = (extra = {}) => ({
    orderNumber: 'SE-BR-777001',
    customerName: 'Ana',
    customerEmail: 'ana@exemplo.com',
    currency: 'BRL',
    totalPrice: 130,
    paymentMethod: 'card',
    shippingCarrier: 'ems',
    trackingCode: 'EE123456789JP',
    shippingAddress: { name: 'Ana Lima', postalCode: '01000-000', city: 'Sao Paulo', prefecture: 'SP', address: 'Rua A, 1', building: 'Ap 2', country: 'Brasil' },
    items: [
      { productName: 'Pocky', variantLabel: 'Kit 3', quantity: 2, price: 45, image: 'https://exemplo.com/p.jpg' },
      { productName: 'Brinde KitKat', quantity: 1, price: 0, freeGift: true },
    ],
    priceBreakdown: { subtotal: 90, shipping: 40, paymentFee: 0 },
    ...extra,
  });

  it('traz código, transportadora, botão de rastreio, itens, conta e endereço no corpo', () => {
    const { subject, html } = buildOrderEmail(enviadoPedido(), { tracking: true });
    expect(subject).toBe('Pedido enviado - #SE-BR-777001');
    expect(html).toContain('EE123456789JP');
    expect(html).toContain('EMS');
    expect(html).toContain('Rastrear meu pedido');
    expect(html).toContain('/rastrear');
    expect(html).toContain('Pocky');
    expect(html).toContain('Kit 3');
    expect(html).toContain('Brinde');
    expect(html).toContain('src="https://exemplo.com/p.jpg"');
    expect(html).toContain('Subtotal dos produtos');
    expect(html).toContain('Rua A, 1');
    expect(html).toContain('Ana Lima');
    expect(html).toContain('Alfandega e tributos');
    expect(html).toContain('https://wa.me/817013671679');
  });

  it('só aceita link de rastreio https; o resto cai no rastreio do próprio site', () => {
    const bom = buildOrderEmail(enviadoPedido({ trackingUrl: 'https://rastreio.exemplo.com/EE1' }), { tracking: true }).html;
    expect(bom).toContain('href="https://rastreio.exemplo.com/EE1"');
    const ruim = buildOrderEmail(enviadoPedido({ trackingUrl: 'javascript:alert(1)' }), { tracking: true }).html;
    expect(ruim).not.toContain('javascript:');
    expect(ruim).toContain('/rastrear');
  });

  it('miniatura só com imagem https e tudo que vem de fora é escapado', () => {
    const { html } = buildOrderEmail(enviadoPedido({
      trackingCode: '<script>x</script>',
      items: [{ productName: '<b>X</b>', quantity: 1, price: 10, image: 'http://inseguro.com/a.jpg' }],
    }), { tracking: true });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>X</b>');
    expect(html).not.toContain('inseguro.com');
  });

  it('sem código ainda, avisa que aguarda a transportadora; pedido local não fala de alfândega', () => {
    const semCodigo = buildOrderEmail(enviadoPedido({ trackingCode: '', trackingNumber: '' }), { tracking: true }).html;
    expect(semCodigo).toContain('Aguardando a transportadora');
    const local = buildOrderEmail(enviadoPedido({ fulfillment: 'local', shipFrom: 'Brasil' }), { tracking: true }).html;
    expect(local).toContain('Seu pedido saiu do Brasil');
    expect(local).not.toContain('Alfandega e tributos');
    const misto = buildOrderEmail(enviadoPedido({ fulfillment: 'mixed', shipFrom: 'Brasil' }), { tracking: true }).html;
    expect(misto).toContain('dois envios');
  });

  it('o texto puro leva o código e o link, e a loja continua recebendo o aviso de novo pedido', () => {
    const { html } = buildOrderEmail(enviadoPedido(), { tracking: true });
    expect(html).toContain('Codigo de rastreio');
    // o aviso de pedido novo e o e-mail de confirmação não mudam
    expect(buildOrderEmail(enviadoPedido(), { store: true }).subject).toContain('Novo pedido');
    expect(buildOrderEmail(enviadoPedido()).subject).toContain('Pedido recebido');
  });
});
