import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // `shared/` também entra: é o código que api/ e src/ dividem (preço, pontos,
    // texto de promoção), justamente onde uma divergência entre os dois lados
    // passa despercebida.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "api/**/*.{test,spec}.js", "shared/**/*.{test,spec}.js"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
