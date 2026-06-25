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
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
      <Header />
      {/* pt-20 = header (80px) + pt extra para a barra de confiança (~28px) nas páginas de cliente */}
      <main className={`flex-1 w-full max-w-full overflow-x-hidden ${isAdminPage ? 'pt-20' : 'pt-[108px]'}`}>
        {children}
      </main>
      <Footer />
      {!isAdminPage && <KimiClawAssistant />}
      <AdminPreviewBar />
    </div>
  );
};

export default Layout;
