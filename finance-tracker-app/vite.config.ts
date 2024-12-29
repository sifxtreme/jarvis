import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "./client",
  server: {
    port: 3001
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src")
    }
  }
});
