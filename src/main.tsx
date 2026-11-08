import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { migrateLocalStorage } from "./utils/migrate";
import { isChunkLoadError, recoverFromChunkError } from "./utils/recoverFromChunkError";
import { marcarAtualizacaoPronta } from "./utils/appUpdate";

migrateLocalStorage();

// Registra o Service Worker. Atualização como numa loja de apps: o build novo
// é baixado em segundo plano e entra na próxima troca de página
// (`components/AppUpdater`), sem reinstalar o app.
//
// Com `registerType: "autoUpdate"` o plugin ignora `onNeedRefresh` e, sem
// `onNeedReload`, chama `location.reload()` sozinho assim que o SW novo
// ativa — no meio da navegação, sem toque nenhum. No PWA do iOS esse reload
// fora de um gesto é o gatilho do bug do WebKit "tela em branco até rolar".
// `onNeedReload` só marca a versão como pronta; quem recarrega é o toque.
registerSW({
  immediate: true,
  onNeedReload() {
    marcarAtualizacaoPronta();
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
