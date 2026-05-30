import React from 'react';
import Header from './Header';
import Footer from './Footer';
import KimiClawAssistant from '../KimiClawAssistant';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        {children}
      </main>
      <Footer />
      <KimiClawAssistant />
    </div>
  );
};

export default Layout;
