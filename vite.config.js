import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mobile-first technician PWA.
// `host: true` exposes the dev server on the local network so you can open it
// on a real phone (e.g. http://<your-pc-ip>:5174) while developing.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      // Wire to the same backend as the dashboard when the /api/tech/* routes exist.
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});
