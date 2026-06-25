import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, CountryType } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import FlagIcon from '@/components/FlagIcon';
import { WORLD_COUNTRIES } from '@/data/worldCountries';

const CountrySwitcher: React.FC = () => {
  const { selectedCountry, setSelectedCountry } = useLanguage();
  const { items } = useCart();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const countries: { code: CountryType; flagCode: string; label: string; details: string }[] =
    WORLD_COUNTRIES.map(c => ({
      code: c.name,
      flagCode: c.iso,
      label: c.name,
      details: c.name === 'Japão' ? 'Japan Express (Local)' : 'Japan Express (Aéreo)',
    }));

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
      description: `Seu destino agora é: ${country} (${selected?.details})`,
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
        <FlagIcon code={currentCountry.flagCode} alt={currentCountry.label} size={20} />
        <span>{currentCountry.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border shadow-lg z-50 py-1.5 animate-fade-in">
          {/* Busca */}
          <div className="px-2 pb-1.5 border-b border-border mb-1">
            <input
              autoFocus
              type="text"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Buscar país..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
          {countries
            .filter(c => !countrySearch || c.label.toLowerCase().includes(countrySearch.toLowerCase()))
            .map((countryItem) => (
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
                <FlagIcon code={countryItem.flagCode} alt={countryItem.label} size={20} />
                <span>{countryItem.label}</span>
              </div>
              {selectedCountry === countryItem.code && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              )}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountrySwitcher;
