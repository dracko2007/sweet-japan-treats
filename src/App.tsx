import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { UserProvider } from "@/context/UserContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { firebaseConfigReady, firebaseConfigSource } from "@/config/firebase";
import Index from "./pages/Index";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderReview from "./pages/OrderReview";
import OrderConfirmation from "./pages/OrderConfirmation";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Shipping from "./pages/Shipping";
import About from "./pages/About";
import Vlog from "./pages/Vlog";
import Admin from "./pages/Admin";
import Wishlist from "./pages/Wishlist";
import TrackOrder from "./pages/TrackOrder";
import ProductDetail from "./pages/ProductDetail";
import AffiliatePage from "./pages/Affiliate";
import NotFound from "./pages/NotFound";
import FirebaseSync from "./pages/FirebaseSync";
import SyncData from "./pages/SyncData";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireAdmin from "./components/RequireAdmin";

const queryClient = new QueryClient();

const App = () => (
  <LanguageProvider>
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <ProductsProvider>
      <CartProvider>
        <TooltipProvider>
          {!firebaseConfigReady && (
            <div className="bg-red-600 text-white text-sm text-center py-2 px-4">
              Firebase não configurado. Fonte: {firebaseConfigSource}. Verifique as variáveis VITE_FIREBASE_* no Vercel e faça redeploy.
            </div>
          )}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <ErrorBoundary>
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
                <Route path="/sobre" element={<About />} />
                <Route path="/vlog" element={<Vlog />} />
                <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                <Route path="/favoritos" element={<Wishlist />} />
                <Route path="/afiliado" element={<AffiliatePage />} />
                <Route path="/rastrear" element={<TrackOrder />} />
                <Route path="/firebase-sync" element={<RequireAdmin><FirebaseSync /></RequireAdmin>} />
                <Route path="/sync-data" element={<RequireAdmin><SyncData /></RequireAdmin>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
      </ProductsProvider>
    </UserProvider>
  </QueryClientProvider>
  </LanguageProvider>
);

export default App;
