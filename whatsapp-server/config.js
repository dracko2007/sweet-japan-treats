/**
 * Configuração do servidor de WhatsApp.
 */
const authToken = (process.env.WHATSAPP_AUTH_TOKEN || '').trim();
if (!authToken) {
  throw new Error('WHATSAPP_AUTH_TOKEN must be configured before starting the WhatsApp server');
}

module.exports = {
  // Porta HTTP em que este servidor vai escutar
  serverPort: 3220,

  // Origens permitidas (domínio do site + localhost para testes)
  allowedOrigins: [
    'https://www.japanexpress-store.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ],

  // Token secreto somente no ambiente do servidor. Nunca coloque credenciais
  // neste arquivo ou em variáveis VITE_.
  authToken,

  // Código do país padrão para números sem DDI (Brasil = 55).
  // Se o cliente digitou só o DDD + número, prefixamos com isto.
  defaultCountryCode: '55',
};
