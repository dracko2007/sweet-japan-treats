import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registro feito manualmente em main.tsx (controle do reload)
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Pré-cacheia apenas assets com hash (JS/CSS) — NÃO cacheia HTML para
        // que index.html venha sempre da rede (evita "old chunks" após deploy)
        globPatterns: ["**/*.{js,css,ico,jpg,jpeg,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Limpa caches de versões antigas automaticamente
        cleanupOutdatedCaches: true,
        // SPA: serve index.html para todas as rotas (network-first para HTML)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/firebase-sync/],
        // index.html: sempre busca da rede, usa cache só se offline
        navigationPreload: true,
        runtimeCaching: [
          // Imagens do Firebase Storage — cache 7 dias
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "firebase-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Firestore REST — NetworkFirst (tenta rede, fallback cache 1h)
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "firestore-data",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts — cache longo
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Japan Express - Importados do Japão",
        short_name: "Japan Express",
        description: "Produtos originais do Japão entregues com cuidado.",
        start_url: "/?utm_source=pwa",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#f97316",
        lang: "pt-BR",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
