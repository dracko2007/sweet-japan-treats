/**
 * WhatsApp Service usando Twilio API
 * Permite envio automático de mensagens WhatsApp
 */

const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = import.meta.env.VITE_TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

interface WhatsAppMessage {
  to: string;
  message: string;
}

export const whatsappService = {
  /**
   * Send WhatsApp message via Twilio API
   */
  sendMessage: async (data: WhatsAppMessage): Promise<boolean> => {
    console.log('📱 WhatsApp Service - Sending message');
    console.log('📱 To:', data.to);
    console.log('📱 Message preview:', data.message.substring(0, 100) + '...');

    // Try sending via local WhatsApp Node.js service (http://localhost:3001/api/send)
    try {
      console.log('📱 Attempting local WhatsApp service (port 3001)...');
      const cleanPhone = data.to.replace(/[^0-9]/g, '');
      const response = await fetch('http://localhost:3001/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: data.message
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('✅ WhatsApp sent successfully via local service!');
          return true;
        }
      }
      console.log('⚠️ Local service failed, trying Twilio / Web fallback...');
    } catch (e) {
      console.log('⚠️ Local service not available on port 3001, trying Twilio / Web fallback...', e);
    }

    console.log('📱 From:', TWILIO_WHATSAPP_FROM);
    console.log('📱 Account SID configured:', !!TWILIO_ACCOUNT_SID, TWILIO_ACCOUNT_SID?.substring(0, 10) + '...');
    console.log('📱 Auth Token configured:', !!TWILIO_AUTH_TOKEN, TWILIO_AUTH_TOKEN?.substring(0, 5) + '...');
    
    // If no credentials, fallback to opening WhatsApp Web
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.warn('⚠️ Twilio credentials not configured - opening WhatsApp Web instead');
      console.log('⚠️ SID:', !!TWILIO_ACCOUNT_SID, 'Token:', !!TWILIO_AUTH_TOKEN);
      
      // Format phone number (remove non-digits and add country code)
      const phoneNumber = data.to.replace(/[^0-9+]/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;
      
      console.log('🌐 Opening WhatsApp Web:', whatsappUrl.substring(0, 50) + '...');
      window.open(whatsappUrl, '_blank');
      return false;
    }
    
    try {
      // Twilio API endpoint
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      
      // Format phone number - ensure it starts with +
      const formattedTo = data.to.startsWith('+') ? data.to : `+${data.to}`;
      const whatsappTo = `whatsapp:${formattedTo}`;
      
      console.log('📤 Formatted recipient:', whatsappTo);
      console.log('📤 Twilio API URL:', url.substring(0, 60) + '...');
      
      // Prepare request body
      const body = new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: whatsappTo,
        Body: data.message
      });
      
      console.log('📤 Request body prepared');
      
      // Make API call with Basic Auth
      const authString = `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`;
      const authHeader = 'Basic ' + btoa(authString);
      
      console.log('📤 Auth header created (length:', authHeader.length, ')');
      console.log('📤 Sending request to Twilio...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body: body.toString()
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Twilio API error response:', errorText);
        
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText };
        }
        
        console.error('❌ Twilio API error details:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        
        // Fallback to WhatsApp Web
        console.log('🔄 Falling back to WhatsApp Web...');
        const phoneNumber = data.to.replace(/[^0-9+]/g, '');
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;
        window.open(whatsappUrl, '_blank');
        
        return false;
      }

      const result = await response.json();
      console.log('✅ WhatsApp sent successfully via Twilio!');
      console.log('📱 Message SID:', result.sid);
      console.log('📱 Status:', result.status);
      console.log('📱 To:', result.to);
      console.log('📱 From:', result.from);
      return true;
    } catch (error) {
      console.error('❌ Error sending WhatsApp:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      
      // Fallback to WhatsApp Web
      console.log('🔄 Falling back to WhatsApp Web due to error...');
      const phoneNumber = data.to.replace(/[^0-9+]/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;
      window.open(whatsappUrl, '_blank');
      
      return false;
    }
  },

  /**
   * Send multiple WhatsApp messages
   */
  sendMultiple: async (messages: WhatsAppMessage[]): Promise<void> => {
    console.log(`📱 Sending ${messages.length} WhatsApp messages...`);
    
    for (const message of messages) {
      await whatsappService.sendMessage(message);
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
