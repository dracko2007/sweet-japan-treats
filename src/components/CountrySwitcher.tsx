import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CountrySwitcher: React.FC = () => {
  const { selectedCountry, setSelectedCountry } = useLanguage();
  const { items } = useCart();
  const { toast } = useToast();

  const handleCountryChange = (country: 'Brasil' | 'Japão') => {
    if (country === 'Brasil') {
      const hasJapanOnlyItems = items.some(item => item.product.deliveryRestrict === 'Japão');
      if (hasJapanOnlyItems) {
        toast({
          title: "Restrição de Destino",
          description: "Remova os produtos de Doce de Leite do carrinho para alterar o destino de envio para o Brasil.",
          variant: "destructive",
        });
        return;
      }
    }
    setSelectedCountry(country);
    toast({
      title: "Destino de Entrega Alterado",
      description: `Seu destino agora é: ${country === 'Japão' ? 'Japão 🇯🇵 (Sabor do Campo)' : 'Brasil 🇧🇷 (SakuraExpress)'}`,
    });
  };

  return (
    <div className="flex items-center bg-secondary/80 p-0.5 rounded-full border border-border">
      <button
        onClick={() => handleCountryChange('Japão')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200",
          selectedCountry === 'Japão'
            ? "bg-primary text-primary-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span>🇯🇵</span>
        <span>Japão</span>
      </button>
      <button
        onClick={() => handleCountryChange('Brasil')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200",
          selectedCountry === 'Brasil'
            ? "bg-primary text-primary-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span>🇧🇷</span>
        <span>Brasil</span>
      </button>
    </div>
  );
};

export default CountrySwitcher;
