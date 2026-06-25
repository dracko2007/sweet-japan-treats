import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { migrateLocalStorage } from "./utils/migrate";
import { isChunkLoadError, recoverFromChunkError } from "./utils/recoverFromChunkError";

migrateLocalStorage();

// Registra o Service Worker e força atualização imediata quando há nova versão.
// Sem isso o PWA pode ficar "preso" no cache antigo (CSS/layout) mesmo após deploy.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nova versão disponível → ativa e recarrega para aplicar o CSS/JS novos
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    // Verifica atualização a cada 60s enquanto o app está aberto
    if (registration) {
      setInterval(() => registration.update().catch(() => {}), 60_000);
    }
  },
});

// Quando o SW carrega um chunk antigo que já não existe no novo deploy,
// o browser lança erro de "dynamically imported module". Limpamos o cache do
// SW e recarregamos de forma limpa (com proteção contra loop infinito).
window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason || "");
  if (isChunkLoadError(msg)) {
    event.preventDefault();
    void recoverFromChunkError();
  }
});

// Mesmo erro pode chegar como erro de import de <script> (não rejection).
window.addEventListener("error", (event) => {
  const msg = event.message || String((event as ErrorEvent).error || "");
  if (isChunkLoadError(msg)) {
    void recoverFromChunkError();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
