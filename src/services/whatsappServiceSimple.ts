/**
 * Simple WhatsApp Service
 * Abre o WhatsApp Web ou app - APENAS para o admin testar
 * NÃO deve ser usado durante o checkout do cliente!
 */

interface WhatsAppMessage {
  to: string;
  message: string;
}

export const whatsappServiceSimple = {
  /**
   * Send WhatsApp message by opening WhatsApp Web/App
   * ⚠️ ATENÇÃO: Isso abre uma janela! Use apenas para testes no admin.
   * Durante o checkout, use apenas com Twilio API configurado.
   */
  sendMessage: (data: WhatsAppMessage): void => {
    console.log('📱 WhatsApp Simple - Opening WhatsApp (ADMIN ONLY)');
    console.log('⚠️ Isso abrirá uma janela do WhatsApp - use apenas para testes!');
    console.log('📱 To:', data.to);
    console.log('📱 Message preview:', data.message.substring(0, 100) + '...');
    
    // Format phone number - remove all non-digits and ensure it starts with country code
    let phoneNumber = data.to.replace(/[^0-9]/g, '');
    
    // If doesn't start with 81 (Japan), add it
    if (!phoneNumber.startsWith('81')) {
      phoneNumber = '81' + phoneNumber;
    }
    
    console.log('📱 Formatted phone:', phoneNumber);
    
    // Create WhatsApp link
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;
    
    console.log('🌐 Opening WhatsApp:', whatsappUrl.substring(0, 50) + '...');
    
    // Open in new window
    const win = window.open(whatsappUrl, '_blank');
    
    if (!win || win.closed || typeof win.closed === 'undefined') {
      console.warn('⚠️ Popup bloqueado - tentando abrir na mesma janela');
      window.location.href = whatsappUrl;
    } else {
      console.log('✅ WhatsApp opened successfully!');
    }
  },

  /**
   * Send multiple WhatsApp messages with delay
   */
  sendMultiple: async (messages: WhatsAppMessage[]): Promise<void> => {
    console.log(`📱 Opening ${messages.length} WhatsApp conversations...`);
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      console.log(`📱 Opening message ${i + 1}/${messages.length}...`);
      
      whatsappServiceSimple.sendMessage(message);
      
      // Wait before opening next one (to avoid popup blocker)
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('✅ All WhatsApp conversations opened!');
  }
};
