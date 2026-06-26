import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { UserProvider } from "@/context/UserContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { firebaseConfigReady, firebaseConfigSource, app } from "@/config/firebase";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { ADMIN_EMAIL, ADMIN_USER_ID } from "@/config/admin";
import ScrollToTop from "./components/ScrollToTop";
import { referralService } from "@/services/referralService";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireAdmin from "./components/RequireAdmin";
import CookieBanner from "./components/CookieBanner";
import InstallPrompt from "./components/InstallPrompt";
import MaintenancePage from "./pages/Maintenance";

// Code splitting: cada página carregada apenas quando necessária
const Index            = lazy(() => import("./pages/Index"));
const Products         = lazy(() => import("./pages/Products"));
const Cart             = lazy(() => import("./pages/Cart"));
const Checkout         = lazy(() => import("./pages/Checkout"));
const OrderReview      = lazy(() => import("./pages/OrderReview"));
const OrderConfirmation= lazy(() => import("./pages/OrderConfirmation"));
const Register         = lazy(() => import("./pages/Register"));
const Login            = lazy(() => import("./pages/Login"));
const Profile          = lazy(() => import("./pages/Profile"));
const Shipping         = lazy(() => import("./pages/Shipping"));
const Offers           = lazy(() => import("./pages/Offers"));
const HowItWorks       = lazy(() => import("./pages/HowItWorks"));
const About            = lazy(() => import("./pages/About"));
const Vlog             = lazy(() => import("./pages/Vlog"));
const Admin            = lazy(() => import("./pages/Admin"));
const Wishlist         = lazy(() => import("./pages/Wishlist"));
const TrackOrder       = lazy(() => import("./pages/TrackOrder"));
const ProductDetail    = lazy(() => import("./pages/ProductDetail"));
const AffiliatePage    = lazy(() => import("./pages/Affiliate"));
const CustomRequest    = lazy(() => import("./pages/CustomRequest"));
const Business         = lazy(() => import("./pages/Business"));
const NotFound         = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy    = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService   = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy     = lazy(() => import("./pages/CookiePolicy"));
const ReturnPolicy     = lazy(() => import("./pages/ReturnPolicy"));
const FirebaseSync     = lazy(() => import("./pages/FirebaseSync"));
const SyncData         = lazy(() => import("./pages/SyncData"));
const Promotion        = lazy(() => import("./pages/Promotion"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 5 * 60 * 1000 },
  },
});

// Analytics só carrega após consentimento
const AnalyticsLoader: React.FC = () => {
  const { consent } = useCookieConsent();
  const location = useLocation();

  useEffect(() => {
    if (consent !== 'accepted' || !app) return;
    import('firebase/analytics').then(({ getAnalytics }) => {
      try { getAnalytics(app!); } catch { /* já inicializado */ }
    });
    // Rastreia visita única por sessão (país + cidade para o painel admin)
    import('@/services/visitorService').then(({ visitorService }) => {
      visitorService.trackVisit().catch(() => {});
    });
  }, [consent]);

  // Rastreia visualização de página a cada mudança de rota
  useEffect(() => {
    import('@/services/visitorService').then(({ visitorService }) => {
      visitorService.trackPage(location.pathname).catch(() => {});
    });
  }, [location.pathname]);

  return null;
};

// Rotas sempre acessíveis mesmo em manutenção
const OPEN_PATHS = ['/admin', '/login', '/firebase-sync', '/sync-data'];

// Verifica se há um admin logado via localStorage (sem precisar do UserProvider)
const isAdminLoggedIn = (): boolean => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return u?.id === ADMIN_USER_ID || u?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch { return false; }
};

// Captura referral da URL uma vez ao montar
const ReferralCapture: React.FC = () => {
  useEffect(() => { referralService.captureReferral(); }, []);
  return null;
};

// Shell da app com providers pesados — só monta se NÃO estiver em manutenção
const FullApp: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <ProductsProvider>
      <CartProvider>
        <TooltipProvider>
          {!firebaseConfigReady && (
            <div className="bg-red-600 text-white text-sm text-center py-2 px-4">
              Firebase não configurado. Verifique as variáveis VITE_FIREBASE_* no Vercel e faça redeploy.
            </div>
          )}
          <AnalyticsLoader />
          <ReferralCapture />
          <Toaster />
          <Sonner />
          <ScrollToTop />
          <ErrorBoundary>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/produtos" element={<Products />} />
                <Route path="/produtos/:category" element={<Products />} />
                <Route path="/produto/:id" element={<ProductDetail />} />
                <Route path="/carrinho" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-review" element={<OrderReview />} />
                <Route path="/order-confirmation" element={<OrderConfirmation />} />
                <Route path="/cadastro" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/frete" element={<Shipping />} />
                <Route path="/ofertas" element={<Offers />} />
                <Route path="/como-funciona" element={<HowItWorks />} />
                <Route path="/sobre" element={<About />} />
                <Route path="/vlog" element={<Vlog />} />
                <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path="/favoritos" element={<Wishlist />} />
                <Route path="/afiliado" element={<AffiliatePage />} />
                <Route path="/faca-seu-pedido" element={<CustomRequest />} />
                <Route path="/empresas" element={<Business />} />
                <Route path="/rastrear" element={<TrackOrder />} />
                <Route path="/firebase-sync" element={<RequireAdmin><FirebaseSync /></RequireAdmin>} />
                <Route path="/sync-data" element={<RequireAdmin><SyncData /></RequireAdmin>} />
                <Route path="/privacidade" element={<PrivacyPolicy />} />
                <Route path="/termos" element={<TermsOfService />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/return-policy" element={<ReturnPolicy />} />
                <Route path="/devolucao" element={<ReturnPolicy />} />
                <Route path="/promocao" element={<Promotion />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </TooltipProvider>
      </CartProvider>
      </ProductsProvider>
    </UserProvider>
  </QueryClientProvider>
);

// Camada de manutenção: decide o que renderizar ANTES de montar providers pesados
// Tela leve exibida na primeira visita ever (sem cache).
// Zero Firebase, zero providers pesados — apenas logo + fundo enquanto o fetch REST (~1.5s) confirma o estado.
const CheckingScreen: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-b from-pink-100 via-pink-50 to-white flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <img src="/logo.jpg" alt="Japan Express" className="w-20 h-20 rounded-full object-cover shadow-lg animate-pulse" />
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  </div>
);

const MaintenanceShell: React.FC = () => {
  const { isEnabled, loading } = useMaintenanceMode();
  const location = useLocation();
  const isOpenPath = OPEN_PATHS.some(
    p => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  // Admin e rotas de admin sempre veem o app completo (mesmo em manutenção)
  if (isOpenPath || isAdminLoggedIn()) return <FullApp />;

  // Manutenção confirmada (cache instantâneo ou fetch concluído)
  if (isEnabled) return <MaintenancePage />;

  // Primeira visita sem cache: mostra tela leve enquanto o fetch confirma (máx 1.5s)
  if (loading) return <CheckingScreen />;

  // Site normal
  return <FullApp />;
};

// CookieBanner e InstallPrompt ficam FORA do MaintenanceShell — aparecem em qualquer estado
const App = () => (
  <BrowserRouter>
    <LanguageProvider>
      <CookieBanner />
      <InstallPrompt />
      <MaintenanceShell />
    </LanguageProvider>
  </BrowserRouter>
);

export default App;
