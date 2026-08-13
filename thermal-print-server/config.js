/**
 * Configuração do servidor de impressão térmica.
 * Edite este arquivo para apontar para a sua impressora.
 */
module.exports = {
  // Porta HTTP em que este servidor vai escutar
  serverPort: 3210,

  // Endereço IP da impressora na rede local
  printerIp: '192.168.11.100',

  // Porta da impressora (padrão para a maioria das térmicas de rede)
  printerPort: 9100,

  // Largura do papel em colunas de caracteres
  // 58mm  → 32 colunas
  // 80mm  → 48 colunas
  paperColumns: 48,

  // Origens permitidas (domínio do seu site + localhost para testes)
  allowedOrigins: [
    'https://www.japanexpress-store.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ],

  // Token secreto obligatorio, provisionado fuera del repositorio.
  authToken: (process.env.THERMAL_PRINT_AUTH_TOKEN || '').trim(),
};
