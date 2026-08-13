const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};

/**
 * Browser-safe WhatsApp service.
 *
 * Provider credentials and account-authenticated calls are server-only. This
 * client may use the separately authenticated local service and otherwise
 * opens a manual WhatsApp Web conversation.
 */


interface WhatsAppMessage {
  to: string;
  message: string;
}

export const whatsappService = {
  /**
   * Send a message through the local service, or open WhatsApp Web manually.
   */
  sendMessage: async (data: WhatsAppMessage): Promise<boolean> => {
    devLog('📱 WhatsApp Service - Sending message');
    devLog('📱 To:', data.to);
    devLog('📱 Message preview:', data.message.substring(0, 100) + '...');

    // Browser code never talks directly to a control-plane endpoint. Account
    // credentials remain server-only; use the safe manual WhatsApp fallback
    // when the authenticated admin service is not available.
    const phoneNumber = data.to.replace(/[^0-9+]/g, '');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(data.message)}`;

    devLog('🌐 Opening WhatsApp Web:', whatsappUrl.substring(0, 50) + '...');
    window.open(whatsappUrl, '_blank');
    return false;
  },

  /**
   * Send multiple WhatsApp messages
   */
  sendMultiple: async (messages: WhatsAppMessage[]): Promise<void> => {
    devLog(`📱 Sending ${messages.length} WhatsApp messages...`);
    
    for (const message of messages) {
      await whatsappService.sendMessage(message);
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
