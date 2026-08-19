import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { COMPANY_PROFILE } from '@/config/companyProfile';

interface FloatingWhatsAppButtonProps {
  productName?: string;
}

/**
 * Botão flutuante de WhatsApp inteligente com alta taxa de conversão.
 * Posicionado no canto inferior esquerdo para não colidir com o KimiClaw no canto direito.
 */
const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasDismissedTooltip, setHasDismissedTooltip] = useState(false);

  // Não renderiza no painel administrativo
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const isProductPage = location.pathname.startsWith('/produto/');
  const isCartOrCheckout = location.pathname === '/carrinho' || location.pathname === '/checkout';

  // Mensagens contextuais para acelerar o fechamento de vendas
  let defaultMessage = 'Olá Japan Express! Estou no site e gostaria de tirar uma dúvida sobre os produtos do Japão.';
  if (isProductPage) {
    defaultMessage = 'Olá Japan Express! Estou vendo um produto no site e queria tirar uma dúvida sobre frete e disponibilidade.';
  } else if (isCartOrCheckout) {
    defaultMessage = 'Olá Japan Express! Estou finalizando minha compra e queria confirmar os prazos de entrega e frete.';
  }

  const waNumber = COMPANY_PROFILE.whatsapp.digits;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(defaultMessage)}`;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start font-sans select-none print:hidden">
      {/* Tooltip / Balão de chamada para ação */}
      {!hasDismissedTooltip && (
        <div className="mb-2.5 max-w-[240px] sm:max-w-[280px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl p-3.5 shadow-xl border border-emerald-100 dark:border-emerald-950/60 animate-bounce duration-1000 relative">
          <button
            onClick={() => setHasDismissedTooltip(true)}
            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            aria-label="Fechar dica"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs mb-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Atendimento Rápido</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
            Dúvidas sobre frete, produtos ou entrega do Japão? Fale conosco!
          </p>
        </div>
      )}

      {/* Botão Principal */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar no WhatsApp com a Japan Express"
        className="group relative flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-3.5 rounded-full shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-300 active:scale-95"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <MessageCircle className="w-6 h-6 fill-white" />
        <span className="text-sm font-bold tracking-tight hidden sm:inline-block pr-1">
          WhatsApp
        </span>
      </a>
    </div>
  );
};

export default FloatingWhatsAppButton;
