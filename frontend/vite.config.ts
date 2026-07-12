import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 生产部署在 opcstudio.cc/travel/ 子路径下；开发用根路径
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/travel/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5181,
    proxy: {
      "/api": "http://localhost:4100",
    },
  },
}));
