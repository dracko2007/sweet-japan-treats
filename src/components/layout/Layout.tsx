import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import KimiClawAssistant from '../KimiClawAssistant';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // KimiClaw é assistente do cliente — não aparece no painel admin
  const isAdminPage = useLocation().pathname.startsWith('/admin');
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        {children}
      </main>
      <Footer />
      {!isAdminPage && <KimiClawAssistant />}
    </div>
  );
};

export default Layout;
