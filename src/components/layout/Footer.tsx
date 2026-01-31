import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, MapPin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-accent text-accent-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-lg">DL</span>
              </div>
              <span className="font-display text-xl font-semibold">Doce de Leite</span>
            </div>
            <p className="text-accent-foreground/80 text-sm leading-relaxed max-w-md">
              Doce de leite artesanal brasileiro feito com amor no Japão. 
              Utilizamos ingredientes selecionados e técnicas tradicionais 
              para trazer o verdadeiro sabor do Brasil para sua mesa.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a href="#" className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="mailto:contato@docedeleite.jp" className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Navegação</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/produtos" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  Produtos
                </Link>
              </li>
              <li>
                <Link to="/vlog" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  Vlog
                </Link>
              </li>
              <li>
                <Link to="/frete" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  Calcular Frete
                </Link>
              </li>
              <li>
                <Link to="/sobre" className="text-sm text-accent-foreground/80 hover:text-accent-foreground transition-colors">
                  Quem Somos
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">Contato</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                <span className="text-sm text-accent-foreground/80">
                  Mie Prefecture, Japan
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-primary" />
                <span className="text-sm text-accent-foreground/80">
                  contato@docedeleite.jp
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-accent-foreground/10 mt-10 pt-6 text-center">
          <p className="text-sm text-accent-foreground/60">
            © {new Date().getFullYear()} Doce de Leite. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
