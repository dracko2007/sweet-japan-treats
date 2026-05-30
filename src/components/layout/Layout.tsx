import React from 'react';
import Header from './Header';
import Footer from './Footer';
import KimiClawAssistant from '../KimiClawAssistant';
import AdminPreviewBar from './AdminPreviewBar';

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
      <AdminPreviewBar />
    </div>
  );
};

export default Layout;
