import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { migrateLocalStorage } from "./utils/migrate";

migrateLocalStorage();

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
