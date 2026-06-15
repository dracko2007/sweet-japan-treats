import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { migrateLocalStorage } from "./utils/migrate";

migrateLocalStorage();

createRoot(document.getElementById("root")!).render(<App />);
