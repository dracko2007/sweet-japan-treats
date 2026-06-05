import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, MapPin, MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '817013671679'; // +81 70-1367-1679
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;
const CONTACT_EMAIL = 'contato@japanexpress-store.com';
import { useLanguage } from '@/context/LanguageContext';
import JapanExpressLogo from '@/components/JapanExpressLogo';

const Footer: React.FC = () => {
  const { t, selectedCountry } = useLanguage();
  const isJapan = selectedCountry === 'Japão';

  return (
    <footer className="bg-accent text-accent-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <JapanExpressLogo size={56} />
              <div className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold tracking-tight">Japan</span>
                <span className="font-display font-extrabold text-sm bg-white/15 border border-white/30 px-1.5 py-0.5 rounded-lg">Express</span>
              </div>
            </div>
            <p className="text-accent-foreground/80 text-sm leading-relaxed max-w-md">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://www.instagram.com/japan_express_oficial/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @japan_express_oficial"
                className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="p-2 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t('footer.links')}</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/produtos" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  {t('nav.products')}
                </Link>
              </li>
              <li>
                <Link to="/vlog" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  {t('nav.vlog')}
                </Link>
              </li>
              <li>
                <Link to="/frete" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  {t('nav.shipping')}
                </Link>
              </li>
              <li>
                <Link to="/sobre" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link to="/afiliado" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  Programa de Afiliados
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">{t('footer.contact')}</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                <span className="text-sm text-accent-foreground/80">
                  Hiroshima Prefecture, Japan
                </span>
              </div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-start gap-2 group">
                <Mail className="w-4 h-4 mt-0.5 text-primary" />
                <span className="text-sm text-accent-foreground/80 group-hover:text-accent-foreground transition-colors break-all">
                  {CONTACT_EMAIL}
                </span>
              </a>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 group">
                <MessageCircle className="w-4 h-4 mt-0.5 text-green-400" />
                <span className="text-sm text-accent-foreground/80 group-hover:text-accent-foreground transition-colors">
                  WhatsApp: +81 70-1367-1679
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-accent-foreground/10 mt-10 pt-6 text-center">
          <p className="text-sm text-accent-foreground/60">
            © {new Date().getFullYear()} Japan Express. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
