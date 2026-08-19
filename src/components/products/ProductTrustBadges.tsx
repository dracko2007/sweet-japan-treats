import React from 'react';
import { ShieldCheck, Plane, PackageCheck, MessageCircle, HelpCircle } from 'lucide-react';
import { COMPANY_PROFILE } from '@/config/companyProfile';

interface ProductTrustBadgesProps {
  productName?: string;
  className?: string;
}

/**
 * Selos de confiança e garantias internacionais para quebrar as principais objeções
 * de compras vindas do Japão (originalidade, rastreio, garantia e suporte).
 */
const ProductTrustBadges: React.FC<ProductTrustBadgesProps> = ({ productName, className = '' }) => {
  const waDigits = COMPANY_PROFILE.whatsapp.digits;
  const waMsg = encodeURIComponent(
    `Olá Japan Express! Estou com uma dúvida sobre a entrega/frete do produto: ${productName || 'importado do Japão'}.`
  );
  const waLink = `https://wa.me/${waDigits}?text=${waMsg}`;

  const badges = [
    {
      icon: Plane,
      title: '100% Original do Japão',
      desc: 'Enviado direto de Tóquio com procedência garantida',
      badgeColor: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    },
    {
      icon: PackageCheck,
      title: 'Rastreamento Internacional',
      desc: 'Código Japan Post e Correios do envio até sua casa',
      badgeColor: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    },
    {
      icon: ShieldCheck,
      title: 'Compra Protegida & Garantida',
      desc: 'Garantia total contra extravio ou avaria no transporte',
      badgeColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    },
  ];

  return (
    <div className={`rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5 backdrop-blur-sm shadow-sm space-y-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Garantia & Confiança Japan Express
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800">
          🇯🇵 Envio Direto
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {badges.map((b, idx) => {
          const Icon = b.icon;
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background/80 border border-border/50 hover:border-border transition-colors"
            >
              <div className={`p-2 rounded-lg shrink-0 border ${b.badgeColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground leading-snug">{b.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{b.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 text-xs border-t border-border/40 flex-wrap">
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70" />
          Dúvidas sobre cálculo de frete ou alfândega?
        </span>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 text-xs hover:underline"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Tirar dúvida no WhatsApp →
        </a>
      </div>
    </div>
  );
};

export default ProductTrustBadges;
