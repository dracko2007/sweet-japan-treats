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
    console.log('To:', data.to);
    console.log('Message preview:', data.message.substring(0, 100) + '...');
    
    // If no credentials, fallback to opening WhatsApp Web
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.warn('⚠️ Twilio credentials not configured - opening WhatsApp Web instead');
      
      // Format phone number (remove non-digits and add country code)
      const phoneNumber = data.to.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;
      
      window.open(whatsappUrl, '_blank');
      return false;
    }
    
    try {
      // Twilio API endpoint
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      
      // Prepare request body
      const body = new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: `whatsapp:${data.to}`,
        Body: data.message
      });
      
      // Make API call with Basic Auth
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
        },
        body: body.toString()
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Twilio API error:', error);
        
        // Fallback to WhatsApp Web
        const phoneNumber = data.to.replace(/[^0-9]/g, '');
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;
        window.open(whatsappUrl, '_blank');
        
        return false;
      }

      const result = await response.json();
      console.log('✅ WhatsApp sent successfully via Twilio');
      console.log('📱 Message SID:', result.sid);
      return true;
    } catch (error) {
      console.error('❌ Error sending WhatsApp:', error);
      
      // Fallback to WhatsApp Web
      const phoneNumber = data.to.replace(/[^0-9]/g, '');
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
