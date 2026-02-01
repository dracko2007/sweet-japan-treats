/**
 * EmailJS Configuration
 * Fallback quando variáveis de ambiente não estão disponíveis
 */

export const emailJsConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_19eq2gy',
  templateIdCustomer: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_nlqjxk9', // Template para cliente
  templateIdStore: import.meta.env.VITE_EMAILJS_TEMPLATE_STORE_ID || 'template_i1a1kp3', // Template para loja
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'Ze9lzkIiBWIQb7XN8'
};

// Log para debug
console.log('📧 EmailJS Config:', {
  serviceId: emailJsConfig.serviceId,
  templateCustomer: emailJsConfig.templateIdCustomer,
  templateStore: emailJsConfig.templateIdStore,
  publicKey: emailJsConfig.publicKey ? emailJsConfig.publicKey.substring(0, 5) + '...' : 'MISSING',
  source: import.meta.env.VITE_EMAILJS_SERVICE_ID ? 'env vars' : 'hardcoded fallback'
});

// Log para debug
console.log('📧 EmailJS Config:', {
  serviceId: emailJsConfig.serviceId,
  templateId: emailJsConfig.templateId,
  publicKey: emailJsConfig.publicKey ? emailJsConfig.publicKey.substring(0, 5) + '...' : 'MISSING',
  source: import.meta.env.VITE_EMAILJS_SERVICE_ID ? 'env vars' : 'hardcoded fallback'
});
