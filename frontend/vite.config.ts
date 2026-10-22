import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// same-origin /api in prod (Vercel); proxy to Flask locally so the code path is identical
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:5001" } },
});
