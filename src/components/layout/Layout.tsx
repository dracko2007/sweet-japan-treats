import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AdminPreviewBar from './AdminPreviewBar';
import { useBirthdayBonus } from '@/hooks/useBirthdayBonus';
import OrganizationJsonLd from '@/components/OrganizationJsonLd';
import { useUser } from '@/context/UserContext';
import { affiliateService } from '@/services/affiliateService';
// Widget não-crítico (chat flutuante): carregado sob demanda para manter o
// chunk compartilhado (Layout) leve. Ausência momentânea do botão não afeta
// o conteúdo principal da página — fallback null é apropriado aqui.
const KimiClawAssistant = lazy(() => import('../KimiClawAssistant'));
const FloatingWhatsAppButton = lazy(() => import('../FloatingWhatsAppButton'));

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // KimiClaw e WhatsApp são assistentes do cliente — não aparecem no painel admin
  const isAdminPage = useLocation().pathname.startsWith('/admin');
  const { user } = useUser();
  const [affiliateNotice, setAffiliateNotice] = useState(0);
  useEffect(() => {
    let active = true;
    if (!user?.email) { setAffiliateNotice(0); return () => { active = false; }; }
    affiliateService.getByOwnerEmail(user.email).then(async (affiliates) => {
      const pending = await Promise.all(affiliates.map((affiliate) => affiliateService.getPendingByCode(affiliate.code)));
      if (active) setAffiliateNotice(pending.reduce((total, items) => total + items.length, 0));
    }).catch(() => { if (active) setAffiliateNotice(0); });
    return () => { active = false; };
  }, [user?.email]);
  useBirthdayBonus(); // concede 1000 pts no aniversário
  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-clip">
      <OrganizationJsonLd />
      <Header />
      {affiliateNotice > 0 && !isAdminPage && (
        <Link to="/afiliado" className="fixed top-2 right-4 z-[60] rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg">
          Nova atualização no painel de afiliado ({affiliateNotice})
        </Link>
      )}
      {/* Cliente mobile: barra de confiança (~28px) + topo (80px) = 108px.
          Desktop também inclui a navegação (~32px), totalizando ~140px.
          overflow-x-clip contém efeitos 3D sem criar um novo scroll container. */}
      <main className={`flex-1 w-full max-w-full overflow-x-clip ${isAdminPage ? 'pt-20' : 'pt-[108px] md:pt-[140px]'}`}>
        {children}
      </main>
      <Footer />
      {!isAdminPage && (
        <>
          <Suspense fallback={null}>
            <KimiClawAssistant />
          </Suspense>
          <Suspense fallback={null}>
            <FloatingWhatsAppButton />
          </Suspense>
        </>
      )}
      <AdminPreviewBar />
    </div>
  );
};

export default Layout;
