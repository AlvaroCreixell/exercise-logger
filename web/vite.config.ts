/// <reference types="vitest/config" />
import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

function copyIndexTo404(): Plugin {
  return {
    name: "copy-index-to-404",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      const index = path.join(dist, "index.html");
      const notFound = path.join(dist, "404.html");
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, notFound);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/exercise-logger/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Exercise Logger",
        short_name: "ExLog",
        description: "Local-first gym routine tracker",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait",
        scope: "/exercise-logger/",
        start_url: "/exercise-logger/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
    copyIndexTo404(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
