import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MessageCircle,
  X,
  Sparkles,
  Truck,
  Building2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { COMPANY_PROFILE } from '@/config/companyProfile';

interface FloatingWhatsAppButtonProps {
  productName?: string;
}

/**
 * Botão e Modal Flutuante de WhatsApp com Hub de Atendimento Direto do Japão.
 * Reproduz o design profissional de menu interativo de alta conversão.
 */
const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Não renderiza dentro do painel administrativo ou se o usuário fechou
  if (location.pathname.startsWith('/admin') || isDismissed) {
    return null;
  }

  const isProductPage = location.pathname.startsWith('/produto/');
  const isCartOrCheckout = location.pathname === '/carrinho' || location.pathname === '/checkout';

  const waNumber = COMPANY_PROFILE.whatsapp.digits;

  const handleOptionClick = (baseMessage: string) => {
    let finalMessage = baseMessage;
    if (isProductPage) {
      finalMessage += ' (Estou navegando na página de produto)';
    } else if (isCartOrCheckout) {
      finalMessage += ' (Estou finalizando um pedido no checkout)';
    }
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(finalMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const supportOptions = [
    {
      id: 'duvidas',
      title: 'Tirar Dúvidas & Suporte',
      desc: 'Fale direto com nossa equipe no Japão em português',
      icon: MessageCircle,
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
      message: 'Olá Japan Express! Gostaria de tirar dúvidas sobre produtos e suporte da loja.',
    },
    {
      id: 'personal_shopper',
      title: 'Personal Shopper / Encomendas',
      desc: 'Quer um produto que não está no site? Nós compramos para você!',
      icon: Sparkles,
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40',
      message: 'Olá Japan Express! Tenho interesse no serviço de Personal Shopper para encomendar um produto do Japão.',
    },
    {
      id: 'frete',
      title: 'Consultar Frete & Prazos',
      desc: 'Simule o envio Japan Post com código de rastreamento',
      icon: Truck,
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40',
      message: 'Olá Japan Express! Gostaria de consultar prazos e valores de frete do Japão para meu endereço.',
    },
    {
      id: 'b2b',
      title: 'Atacado & Revenda (B2B)',
      desc: 'Condições especiais para salões de beleza, clínicas e lojistas',
      icon: Building2,
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40',
      message: 'Olá Japan Express! Gostaria de informações sobre compras no atacado e revenda B2B.',
    },
  ];

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start font-sans select-none print:hidden">
      {/* Modal / Card Interativo de Atendimento */}
      {isOpen && (
        <div className="mb-3 w-[340px] sm:w-[380px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header do Chat */}
          <div className="p-4 bg-gradient-to-r from-slate-50 to-emerald-50/40 dark:from-slate-800/60 dark:to-slate-800/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                  <MessageCircle className="w-5 h-5 fill-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                  Atendimento Japan Express
                </h4>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online direto do Japão
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              aria-label="Fechar atendimento"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Corpo: Texto de Boas-vindas e Opções */}
          <div className="p-4 space-y-2.5">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Como podemos te ajudar hoje? Selecione um assunto para iniciar o atendimento no WhatsApp:
            </p>

            <div className="space-y-2 pt-1">
              {supportOptions.map((opt) => {
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionClick(opt.message)}
                    className="w-full text-left p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 hover:bg-emerald-50/60 dark:bg-slate-800/40 dark:hover:bg-slate-800 hover:border-emerald-200 dark:hover:border-emerald-700/50 transition-all duration-200 flex items-center justify-between group shadow-sm hover:shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${opt.iconBg} group-hover:scale-105 transition-transform`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {opt.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rodapé com Selo e Origem */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Atendimento 100% em Português
            </span>
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              Hiroshima-ken, Japão 🇯🇵
            </span>
          </div>
        </div>
      )}

      {/* Botão de Gatilho (Pill) com botão de minimizar/fechar */}
      <div className="group flex items-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-300 border border-emerald-400/30">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Abrir atendimento no WhatsApp"
          className="flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 cursor-pointer select-none"
        >
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
            <MessageCircle className="w-4 h-4 fill-white" />
          </div>
          <span className="text-sm font-bold tracking-tight pr-1">
            WhatsApp Japão
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="p-1.5 mr-1.5 hover:bg-emerald-700/60 rounded-full text-emerald-100 hover:text-white transition-colors cursor-pointer"
          title="Fechar botão de WhatsApp"
          aria-label="Fechar botão de WhatsApp"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default FloatingWhatsAppButton;
