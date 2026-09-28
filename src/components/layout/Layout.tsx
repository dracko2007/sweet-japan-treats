import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import Header from './Header';
import HeaderPro from './HeaderPro';
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
  // O painel admin continua com o header original.
  const pro = !isAdminPage;
  const reduce = useReducedMotion();
  const { user } = useUser();

  // `nav-pro` libera --bottom-nav-h (index.css) para os botões flutuantes
  // subirem acima da barra inferior no mobile.
  useEffect(() => {
    document.documentElement.classList.toggle('nav-pro', pro);
    return () => document.documentElement.classList.remove('nav-pro');
  }, [pro]);
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
      {pro ? <HeaderPro /> : <Header />}
      {affiliateNotice > 0 && !isAdminPage && (
        <Link to="/afiliado" className="fixed top-2 right-4 z-[60] rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg">
          Nova atualização no painel de afiliado ({affiliateNotice})
        </Link>
      )}
      {/* Cliente mobile: barra de confiança (~28px) + topo (80px) = 108px.
          Desktop também inclui a navegação (~32px), totalizando ~140px.
          overflow-x-clip contém efeitos 3D sem criar um novo scroll container. */}
      <main className={`flex-1 w-full max-w-full overflow-x-clip ${isAdminPage ? 'pt-20' : 'pt-[108px] md:pt-[140px]'} ${pro ? 'pb-16 md:pb-0' : ''}`}>
        {/* Transição de página só com opacidade: transform aqui quebraria o
            pin do ScrollTrigger no hero e os modais `fixed` das páginas. */}
        {pro && !reduce ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
            {children}
          </motion.div>
        ) : (
          children
        )}
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
