import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AdminPreviewBar from './AdminPreviewBar';
import KimiClawAssistant from '../KimiClawAssistant';
import { useBirthdayBonus } from '@/hooks/useBirthdayBonus';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // KimiClaw é assistente do cliente — não aparece no painel admin
  const isAdminPage = useLocation().pathname.startsWith('/admin');
  useBirthdayBonus(); // concede 1000 pts no aniversário
  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-clip">
      <Header />
      {/* pt-20 = header (80px) + navegação (48px) + pt extra para a barra de confiança (~28px) nas páginas de cliente = ~156px total
          overflow-x-clip (não "hidden"): "hidden" forçaria overflow-y:auto aqui e quebraria os
          sidebars sticky do carrinho/checkout — clip contém o overflow sem virar scroll container. */}
      <main className={`flex-1 w-full max-w-full overflow-x-clip ${isAdminPage ? 'pt-20' : 'pt-[156px] md:pt-[140px]'}`}>
        {children}
      </main>
      <Footer />
      {!isAdminPage && <KimiClawAssistant />}
      <AdminPreviewBar />
    </div>
  );
};

export default Layout;
