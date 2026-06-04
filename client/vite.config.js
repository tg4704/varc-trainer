import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In production, the client talks to VITE_API_URL directly (see src/api.js).
// In development, we proxy /api to the local Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
