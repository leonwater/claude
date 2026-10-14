import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "자료 퀴즈",
        short_name: "자료퀴즈",
        description: "내 학습 자료로 객관식 문제를 풀고 오답노트를 관리합니다",
        lang: "ko",
        display: "standalone",
        start_url: "./",
        background_color: "#f6f7f9",
        theme_color: "#2f5bea",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // pdf.js 워커까지 캐시해야 오프라인에서도 앱이 뜬다
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  base: "./",
});
