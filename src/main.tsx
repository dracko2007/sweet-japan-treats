import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { migrateLocalStorage } from "./utils/migrate";

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
// o browser lança "Failed to fetch dynamically imported module".
// Detectamos e recarregamos para pegar os assets novos.
window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason || "");
  if (msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed")) {
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
