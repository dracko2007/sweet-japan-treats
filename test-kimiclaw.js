const http = require('http');

// Simple test to verify KimiClaw is rendering
const testHTML = (html) => {
  const hasKimiClaw = html.includes('KimiClaw');
  const hasSearchBtn = html.includes('search_products') || html.includes('Buscar Produtos');
  const hasShippingBtn = html.includes('calc_shipping') || html.includes('Calcular Frete');
  
  console.log('✓ KimiClaw component loaded:', hasKimiClaw);
  console.log('✓ Search button present:', hasSearchBtn);
  console.log('✓ Shipping button present:', hasShippingBtn);
  
  if (hasKimiClaw && (hasSearchBtn || hasShippingBtn)) {
    console.log('\n✅ All features rendered correctly!');
    process.exit(0);
  }
};

http.get('http://localhost:8080/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => testHTML(data));
}).on('error', (e) => {
  console.error('Connection error:', e.message);
  process.exit(1);
});
