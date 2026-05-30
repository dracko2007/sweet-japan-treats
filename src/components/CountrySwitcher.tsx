import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, CountryType } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const CountrySwitcher: React.FC = () => {
  const { selectedCountry, setSelectedCountry } = useLanguage();
  const { items } = useCart();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const countries: { code: CountryType; flag: string; label: string; details: string }[] = [
    { code: 'Japão', flag: '🇯🇵', label: 'Japão', details: 'SakuraExpress (Local)' },
    { code: 'Brasil', flag: '🇧🇷', label: 'Brasil', details: 'SakuraExpress (Aéreo)' },
    { code: 'Portugal', flag: '🇵🇹', label: 'Portugal', details: 'SakuraExpress (Aéreo)' },
    { code: 'França', flag: '🇫🇷', label: 'França', details: 'SakuraExpress (Aéreo)' },
    { code: 'Itália', flag: '🇮🇹', label: 'Itália', details: 'SakuraExpress (Aéreo)' },
    { code: 'Espanha', flag: '🇪🇸', label: 'Espanha', details: 'SakuraExpress (Aéreo)' },
  ];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCountryChange = (country: CountryType) => {
    setSelectedCountry(country);
    const selected = countries.find(c => c.code === country);
    toast({
      title: "Destino de Entrega Alterado",
      description: `Seu destino agora é: ${country} ${selected?.flag} (${selected?.details})`,
    });
  };

  const currentCountry = countries.find(c => c.code === selectedCountry) || countries[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-secondary/80 border border-border rounded-full hover:bg-secondary transition-all text-xs font-semibold text-foreground shadow-sm focus:outline-none"
      >
        <span>{currentCountry.flag}</span>
        <span>{currentCountry.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-card border border-border shadow-lg z-50 py-1.5 animate-fade-in">
          {countries.map((countryItem) => (
            <button
              key={countryItem.code}
              onClick={() => {
                handleCountryChange(countryItem.code);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors font-medium",
                selectedCountry === countryItem.code
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span>{countryItem.flag}</span>
                <span>{countryItem.label}</span>
              </div>
              {selectedCountry === countryItem.code && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CountrySwitcher;
