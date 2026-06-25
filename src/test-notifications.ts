/**
 * Test script for Email and WhatsApp notifications
 * Run this to verify your configuration is working
 */

import { emailService } from './services/emailService';
import { whatsappService } from './services/whatsappService';

// Test configuration
const TEST_EMAIL = 'dracko2007@gmail.com';
const TEST_PHONE = '+8107013671679';

console.log('🧪 Starting Notification Tests...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  VITE_RESEND_API_KEY:', !!import.meta.env.VITE_RESEND_API_KEY, 
  import.meta.env.VITE_RESEND_API_KEY?.substring(0, 10) + '...');
console.log('  VITE_FROM_EMAIL:', import.meta.env.VITE_FROM_EMAIL);
console.log('  VITE_TWILIO_ACCOUNT_SID:', !!import.meta.env.VITE_TWILIO_ACCOUNT_SID,
  import.meta.env.VITE_TWILIO_ACCOUNT_SID?.substring(0, 10) + '...');
console.log('  VITE_TWILIO_AUTH_TOKEN:', !!import.meta.env.VITE_TWILIO_AUTH_TOKEN,
  import.meta.env.VITE_TWILIO_AUTH_TOKEN?.substring(0, 5) + '...');
console.log('  VITE_TWILIO_WHATSAPP_FROM:', import.meta.env.VITE_TWILIO_WHATSAPP_FROM);
console.log('\n');

// Test Email Service
async function testEmail() {
  console.log('📧 Testing Email Service...');
  
  const testEmailHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #22c55e;">🧪 Test Email</h1>
        <p>This is a test email from Japan Express!</p>
        <p>If you received this, your email configuration is working correctly! ✅</p>
        <p>Time: ${new Date().toLocaleString('pt-BR')}</p>
      </body>
    </html>
  `;
  
  try {
    const result = await emailService.sendOrderConfirmation({
      to: TEST_EMAIL,
      subject: '🧪 Test Email - Japan Express',
      html: testEmailHTML,
      orderNumber: 'TEST-001',
      customerName: 'Test Customer'
    });
    
    if (result) {
      console.log('✅ Email test PASSED!\n');
    } else {
      console.log('⚠️ Email test completed but may not have been sent (check console)\n');
    }
  } catch (error) {
    console.error('❌ Email test FAILED:', error);
    console.log('\n');
  }
}

// Test WhatsApp Service
async function testWhatsApp() {
  console.log('📱 Testing WhatsApp Service...');
  
  const testMessage = `
🧪 *Test Message*

This is a test message from Japan Express!

If you received this, your WhatsApp configuration is working correctly! ✅

Time: ${new Date().toLocaleString('pt-BR')}

_This is an automated test message_
  `.trim();
  
  try {
    const result = await whatsappService.sendMessage({
      to: TEST_PHONE,
      message: testMessage
    });
    
    if (result) {
      console.log('✅ WhatsApp test PASSED!\n');
    } else {
      console.log('⚠️ WhatsApp test completed but may have opened Web WhatsApp instead\n');
    }
  } catch (error) {
    console.error('❌ WhatsApp test FAILED:', error);
    console.log('\n');
  }
}

// Run tests
async function runTests() {
  await testEmail();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  await testWhatsApp();
  console.log('🎉 Tests completed!');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testEmail, testWhatsApp, runTests };
