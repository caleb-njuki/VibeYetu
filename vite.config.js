import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forwards /api calls to the backend we build later (runs on port 5000)
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
